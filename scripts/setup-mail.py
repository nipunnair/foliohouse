"""Collect Bridge credentials locally without echoing or testing them."""

import argparse
import getpass
import json
import os
from pathlib import Path
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[1] / '.private' / 'mail' / 'bridge.json'
    if args.dry_run:
        print(f'Would create {destination} with owner-only permissions; no mailbox connection.')
        return
    if destination.exists():
        raise SystemExit('Configuration already exists; not overwriting it.')
    if not sys.stdin.isatty():
        raise SystemExit('Run this helper in your own interactive terminal.')
    username = input('Bridge username: ').strip()
    folder = input('Proton folder [FolioHouse]: ').strip() or 'FolioHouse'
    site = input('Site ID [demo]: ').strip() or 'demo'
    recipient = input('Publishing recipient address: ').strip()
    if not username or not recipient:
        raise SystemExit('Username and publishing recipient are required.')
    password = getpass.getpass('Bridge-generated password (hidden): ')
    if not password:
        raise SystemExit('Password cannot be empty; nothing saved.')
    configuration = {
        'provider': 'imap',
        'host': '127.0.0.1',
        'port': 1143,
        'security': 'starttls',
        'username': username,
        'password': password,
        'folder': folder,
        'site': site,
        'recipient': recipient,
        'mode': 'draft-only',
        'enabled': False,
    }
    os.umask(0o077)
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    destination.parent.chmod(0o700)
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(configuration, output, indent=2)
        output.write('\n')
    print('Saved locally with owner-only permissions. Mail access remains disabled.')
    print('Password is stored as plaintext on disk, not in macOS Keychain. Do not share this file.')
    print('TLS certificate trust and the exact IMAP folder path still need verification.')


if __name__ == '__main__':
    main()
