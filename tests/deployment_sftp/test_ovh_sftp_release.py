"""Offline adapter tests. No live connection, login, or trust acceptance occurs."""
import base64
import errno
import hashlib
import io
import os
from pathlib import Path
import sys
import posixpath
import stat
import types
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/deployment'))

import paramiko
import ovh_release as release
import ovh_sftp_release as adapter
import test_ovh_release as original


class FakeSFTP:
    def __init__(self, ftp): self.ftp = ftp
    def normalize(self, path): return '/home' if path == '.' else posixpath.normpath(path)
    def lstat(self, path):
        if path in self.ftp.dirs: return types.SimpleNamespace(st_mode=stat.S_IFDIR | 0o755, st_size=0)
        if path in self.ftp.files: return types.SimpleNamespace(st_mode=stat.S_IFREG | 0o644, st_size=len(self.ftp.files[path]))
        raise FileNotFoundError(errno.ENOENT, 'missing')
    def listdir_attr(self, path):
        result=[]
        for name,facts in self.ftp.mlsd(path):
            mode={'dir': stat.S_IFDIR, 'file': stat.S_IFREG}.get(facts['type'],stat.S_IFLNK)
            result.append(types.SimpleNamespace(filename=name,st_mode=mode,st_size=int(facts['size'])))
        return result
    def open(self, path, mode):
        if mode == 'rb':
            stream=io.BytesIO()
            self.ftp.retrbinary('RETR '+path,stream.write)
            stream.seek(0)
            return stream
        if mode != 'wx': raise AssertionError('Must use exclusive stage creation')
        if path in self.ftp.files: raise FileExistsError(errno.EEXIST,'stage exists')
        ftp=self.ftp
        class Writer(io.BytesIO):
            def close(self):
                if not self.closed:
                    self.seek(0);ftp.storbinary('STOR '+path,self)
                super().close()
        return Writer()
    def mkdir(self,path,mode): return self.ftp.mkd(path)
    def posix_rename(self,source,target): return self.ftp.rename(source,target)
    def close(self): pass


class EngineOverSFTPTests(original.ReleaseTests):
    """Run the original deployment/recovery behavior suite through the adapter."""
    def setUp(self):
        super().setUp()
        self.bridge=adapter.SFTPBridge(Mock(),FakeSFTP(self.ftp))
        self.remote=release.Remote(self.bridge)


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.key=Mock()
        self.key.asbytes.return_value=b'approved public key'
        self.key.get_name.return_value='ssh-ed25519'
        self.key.get_bits.return_value=256
        self.fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(self.key.asbytes()).digest()).decode().rstrip('=')
        self.env={'FTP_SERVER':'private-host.example','FTP_USERNAME':'private-user','FTP_PASSWORD':'private-password',
                  'OVH_SFTP_HOST_KEY_TYPE':'ssh-ed25519','OVH_SFTP_HOST_KEY_SHA256':self.fingerprint}
    def test_pin_matches_only_exact_host_type_and_bytes(self):
        pin=adapter.ApprovedHostKey(self.env['FTP_SERVER'],'ssh-ed25519',self.fingerprint)
        pin.missing_host_key(Mock(),self.env['FTP_SERVER'],self.key)
        with self.assertRaises(release.ReleaseError): pin.missing_host_key(Mock(),'different.example',self.key)
        self.key.asbytes.return_value=b'different key'
        with self.assertRaises(release.ReleaseError): pin.missing_host_key(Mock(),self.env['FTP_SERVER'],self.key)
        self.key.asbytes.return_value=b'approved public key';self.key.get_name.return_value='ssh-rsa'
        with self.assertRaises(release.ReleaseError): pin.missing_host_key(Mock(),self.env['FTP_SERVER'],self.key)
    def test_missing_pin_rejects_before_client_or_network(self):
        with patch.dict(os.environ,{**self.env,'OVH_SFTP_HOST_KEY_SHA256':''}),patch.object(paramiko,'SSHClient') as client:
            with self.assertRaises(release.ReleaseError):adapter.connect_sftp()
            client.assert_not_called()
    def test_exact_pin_precedes_password_auth_and_mismatch_stops_auth(self):
        class Client:
            def __init__(self):self.authenticated=False;self.policy=None;self.closed=False
            def set_missing_host_key_policy(self,policy):self.policy=policy
            def connect(client,**kwargs):
                client.policy.missing_host_key(client,kwargs['hostname'],self.key)
                self.assertFalse(kwargs['allow_agent']);self.assertFalse(kwargs['look_for_keys'])
                self.assertEqual(kwargs['port'],22);self.assertEqual(kwargs['username'],'private-user')
                self.assertEqual(kwargs['password'],'private-password')
                client.authenticated=True
            def open_sftp(self):
                sftp=Mock();sftp.normalize.return_value='/home';return sftp
            def close(self):self.closed=True
        good=Client()
        with patch.dict(os.environ,self.env),patch.object(paramiko,'SSHClient',return_value=good):
            adapter.connect_sftp()
        self.assertTrue(good.authenticated)
        bad=Client();self.key.asbytes.return_value=b'changed'
        with patch.dict(os.environ,self.env),patch.object(paramiko,'SSHClient',return_value=bad):
            with self.assertRaises(release.ReleaseError):adapter.connect_sftp()
        self.assertFalse(bad.authenticated);self.assertTrue(bad.closed)
    def test_password_failure_message_redacted(self):
        client=Mock();client.connect.side_effect=paramiko.AuthenticationException('private-host.example private-user private-password')
        with patch.dict(os.environ,self.env),patch.object(paramiko,'SSHClient',return_value=client):
            with self.assertRaisesRegex(release.ReleaseError,'Existing account SFTP authentication was rejected') as error:adapter.connect_sftp()
        self.assertNotIn('private-',str(error.exception));client.close.assert_called_once()
    def test_protocol_failure_message_redacted(self):
        client=Mock();client.connect.side_effect=paramiko.SSHException('private-host.example private-user private-password')
        with patch.dict(os.environ,self.env),patch.object(paramiko,'SSHClient',return_value=client):
            with self.assertRaisesRegex(release.ReleaseError,'Pinned SFTP session could not be established') as error:adapter.connect_sftp()
        self.assertNotIn('private-',str(error.exception));client.close.assert_called_once()
    def test_unexpected_transfer_errors_are_redacted(self):
        for error in (paramiko.SSHException('private-host.example private-password'),
                      paramiko.SFTPError('private-host.example private-password'),
                      EOFError('private-host.example private-password')):
            with patch.object(release, 'main', side_effect=error), patch.object(release, 'connect'), \
                 patch.object(release, 'preflight'), patch('sys.stderr', new_callable=io.StringIO) as output:
                self.assertEqual(adapter.main(), 1)
                self.assertNotIn('private-', output.getvalue())
                self.assertIn('inspect release state', output.getvalue())
    def test_symlink_directory_and_file_rejected(self):
        sftp=Mock();sftp.normalize.return_value='/home';sftp.lstat.return_value.st_mode=stat.S_IFLNK
        bridge=adapter.SFTPBridge(Mock(),sftp)
        with self.assertRaises(release.ReleaseError):bridge.cwd('./www')
        with self.assertRaises(release.ReleaseError):bridge.retrbinary('RETR /home/www/.htaccess',Mock())
        sftp.open.assert_not_called()
    def test_directory_listing_preserves_unsafe_type(self):
        sftp=Mock();sftp.normalize.return_value='/home'
        sftp.listdir_attr.return_value=[types.SimpleNamespace(filename='link',st_mode=stat.S_IFLNK,st_size=5)]
        bridge=adapter.SFTPBridge(Mock(),sftp)
        self.assertEqual(dict(bridge.mlsd('/home'))['link']['type'],'unsafe')
    def test_exclusive_stage_creation_never_truncates_existing_file(self):
        ftp=original.FakeFTP({'existing.txt':b'keep'})
        bridge=adapter.SFTPBridge(Mock(),FakeSFTP(ftp))
        with self.assertRaises(FileExistsError):bridge.storbinary('STOR /home/www/existing.txt',io.BytesIO(b'new'))
        self.assertEqual(ftp.files['/home/www/existing.txt'],b'keep')
    def test_unsupported_overwrite_rename_fails_without_delete_fallback(self):
        sftp=Mock();sftp.normalize.return_value='/home';sftp.posix_rename.side_effect=OSError('unsupported')
        bridge=adapter.SFTPBridge(Mock(),sftp)
        with self.assertRaises(OSError):bridge.rename('/home/www/stage/a','/home/www/b')
        sftp.remove.assert_not_called();sftp.rename.assert_not_called()
    def test_no_missing_file_confusion_on_permission_denial(self):
        sftp=Mock();sftp.normalize.return_value='/home';sftp.lstat.side_effect=PermissionError(errno.EACCES,'denied')
        bridge=adapter.SFTPBridge(Mock(),sftp)
        with self.assertRaises(PermissionError):bridge.retrbinary('RETR /home/www/.htaccess',Mock())
    def test_preflight_transport_label_is_correct_and_private_config_not_printed(self):
        ftp=original.FakeFTP({'index.html':b'old','sw.js':b'worker','.htaccess':b'private config'})
        remote=release.Remote(adapter.SFTPBridge(Mock(),FakeSFTP(ftp)))
        with patch('sys.stdout',new_callable=io.StringIO) as output:result=adapter.sftp_preflight(remote)
        self.assertIn('SFTP',result['transport']);self.assertNotIn('private config',output.getvalue())
        self.assertFalse({'stor','rename','mkd','delete'} & {c[0] for c in ftp.calls})

if __name__=='__main__':unittest.main(verbosity=2)
