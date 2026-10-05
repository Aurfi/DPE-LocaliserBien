#!/usr/bin/env python3
"""Use the existing release/recovery engine over one explicitly pinned SFTP host.

Pin acceptance requires the owner's separate first-use approval. This adapter never
learns or saves keys, changes account settings, opens a shell, or weakens a mismatch.
"""
import base64
import errno
import ftplib
import hashlib
import hmac
import io
import json
import logging
import os
import posixpath
import re
import stat
import sys
import contextlib

import paramiko
import ovh_release as release


class ApprovedHostKey(paramiko.MissingHostKeyPolicy):
    def __init__(self, host, kind, fingerprint):
        release.require(kind in ('ssh-ed25519', 'ecdsa-sha2-nistp256',
                                 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa'),
                        'An approved SSH host-key type is required.')
        release.require(re.fullmatch(r'SHA256:[A-Za-z0-9+/]{43}', fingerprint or ''),
                        'The exact approved SSH host-key fingerprint is required.')
        self.host, self.kind, self.fingerprint = host, kind, fingerprint

    def missing_host_key(self, client, hostname, key):
        actual = 'SHA256:' + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
        release.require(hostname == self.host and key.get_name() == self.kind
                        and hmac.compare_digest(actual, self.fingerprint),
                        'SSH host key differs from the explicitly approved fingerprint; no login attempted.')
        release.require(self.kind != 'ssh-rsa' or key.get_bits() >= 2048,
                        'Approved RSA host key does not meet the minimum size.')
        # Returning accepts only this exact pin in memory. No file or trust store
        # is changed; SSHClient performs password authentication only afterward.


class SFTPBridge:
    """Minimal FTP-shaped transport for the unchanged, fully guarded Remote API."""
    def __init__(self, client, sftp):
        self.client, self.sftp = client, sftp
        self.current = sftp.normalize('.')

    def absolute(self, path):
        return posixpath.normpath(path if path.startswith('/') else posixpath.join(self.current, path))

    def pwd(self):
        return self.current

    def cwd(self, path):
        target = self.absolute(path)
        release.require(stat.S_ISDIR(self.sftp.lstat(target).st_mode),
                        'SFTP destination is not a regular directory.')
        self.current = target

    def mlsd(self, directory, facts=None):
        entries = []
        for item in self.sftp.listdir_attr(self.absolute(directory)):
            mode = item.st_mode or 0
            kind = 'dir' if stat.S_ISDIR(mode) else 'file' if stat.S_ISREG(mode) else 'unsafe'
            entries.append((item.filename, {'type': kind, 'size': str(item.st_size or 0)}))
        return iter(entries)

    def retrbinary(self, command, receive):
        release.require(command.startswith('RETR '), 'Unsupported SFTP read request.')
        path = self.absolute(command[5:])
        try:
            release.require(stat.S_ISREG(self.sftp.lstat(path).st_mode),
                            'SFTP read target is not a regular file.')
            with self.sftp.open(path, 'rb') as stream:
                while chunk := stream.read(32768):
                    receive(chunk)
        except OSError as error:
            if error.errno == errno.ENOENT:
                raise ftplib.error_perm('550 missing public file') from None
            raise

    def storbinary(self, command, source):
        release.require(command.startswith('STOR '), 'Unsupported SFTP stage request.')
        # The release engine writes only unique staging paths. Exclusive-create
        # also rejects an unexpected file/symlink instead of truncating it.
        with self.sftp.open(self.absolute(command[5:]), 'wx') as target:
            while chunk := source.read(32768):
                target.write(chunk)

    def mkd(self, path):
        return self.sftp.mkdir(self.absolute(path), mode=0o755)

    def rename(self, source, target):
        # OpenSSH's overwrite-rename extension, tested on disposable public stage
        # files by the existing engine before any live promotion. No delete fallback.
        return self.sftp.posix_rename(self.absolute(source), self.absolute(target))

    def close(self):
        try:
            self.sftp.close()
        finally:
            self.client.close()


def connect_sftp():
    host, username, password = [os.environ.get(name, '')
                                for name in ('FTP_SERVER', 'FTP_USERNAME', 'FTP_PASSWORD')]
    release.require(all((host, username, password)), 'Required existing hosting secrets are unavailable.')
    release.require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*', host),
                    'The existing configured hosting hostname is invalid.')
    pin = ApprovedHostKey(host, os.environ.get('OVH_SFTP_HOST_KEY_TYPE', ''),
                          os.environ.get('OVH_SFTP_HOST_KEY_SHA256', ''))
    logger = logging.getLogger('paramiko')
    logger.setLevel(logging.CRITICAL + 1)
    logger.propagate = False
    logger.addHandler(logging.NullHandler())
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(pin)
    def transport_factory(*args, **kwargs):
        transport = paramiko.Transport(*args, **kwargs)
        transport.get_security_options().key_types = (('rsa-sha2-512', 'rsa-sha2-256')
                                                      if pin.kind == 'ssh-rsa' else (pin.kind,))
        return transport
    try:
        client.connect(hostname=host, port=22, username=username, password=password,
                       allow_agent=False, look_for_keys=False, timeout=30, banner_timeout=30,
                       auth_timeout=30, channel_timeout=45, transport_factory=transport_factory)
        sftp = client.open_sftp()
        sftp.get_channel().settimeout(45)
        return SFTPBridge(client, sftp)
    except paramiko.AuthenticationException:
        client.close()
        raise release.ReleaseError('Existing account SFTP authentication was rejected.') from None
    except paramiko.SSHException:
        client.close()
        raise release.ReleaseError('Pinned SFTP session could not be established.') from None
    except BaseException:
        client.close()
        raise


_original_preflight = release.preflight

def sftp_preflight(remote):
    with contextlib.redirect_stdout(io.StringIO()):
        result = _original_preflight(remote)
    result['transport'] = 'SFTP; encrypted SSH; exact owner-approved host-key pin'
    print(json.dumps(result, indent=2))
    return result


def main():
    release.connect = connect_sftp
    release.preflight = sftp_preflight
    try:
        return release.main()
    except (paramiko.SSHException, paramiko.SFTPError, EOFError):
        print('Stopped: SFTP transfer ended unexpectedly; inspect release state before retrying.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
