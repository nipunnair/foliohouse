"""Fetch only the designated test message read-only and queue a private draft."""
import imaplib
import argparse
from email import policy
from email.parser import BytesParser
import json
import os
from pathlib import Path
import re
import ssl
import subprocess
import tempfile


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--uid', help='Select a UID from the matching test messages')
    parser.add_argument('--list-candidates', action='store_true', help='List only headers of recent messages addressed to the publishing inbox')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    directory = root / '.private' / 'mail'
    credentials = directory / 'bridge.json'
    if credentials.stat().st_mode & 0o077:
        raise SystemExit('Credentials require owner-only permissions.')
    config = json.loads(credentials.read_text())
    site_id = config['site']
    lookup = subprocess.run(['node', '--input-type=module', '-e', "import {loadSite} from './scripts/sites.mjs'; console.log((await loadSite(process.cwd(),process.argv[1])).inbox)", site_id], cwd=root, capture_output=True, text=True, check=True)
    recipient = lookup.stdout.strip()
    if not recipient or any(c in recipient for c in ['"', '\\', '\r', '\n']):
        raise SystemExit('Invalid publishing recipient in site configuration.')
    if config['host'] != '127.0.0.1' or config['port'] != 1143:
        raise SystemExit('Only the configured local Bridge is supported.')
    folder = config['folder']
    if any(c in folder for c in ['"', '\\', '\r', '\n']):
        raise SystemExit('Unsupported folder name.')
    client = imaplib.IMAP4('127.0.0.1', 1143, timeout=30)
    try:
        client.starttls(ssl_context=ssl.create_default_context(cafile=str(directory / 'bridge-ca.pem')))
        client.login(config['username'], config['password'])
        for candidate in [folder, 'Folders/' + folder]:
            status, _ = client.select('"' + candidate + '"', readonly=True)
            if status == 'OK':
                break
        else:
            raise SystemExit('Publishing folder not found.')
        if args.list_candidates or args.uid:
            status, data = client.uid('search', None, 'TO', '"' + recipient + '"')
        else:
            status, data = client.uid('search', None, 'TO', '"' + recipient + '"', 'SUBJECT', '"FolioHouse test artwork"')
        if status != 'OK':
            raise SystemExit('Test search failed.')
        ids = data[0].split()
        if not ids:
            raise SystemExit('No matching test message in publishing folder. Check recipient, subject and filter.')
        if args.uid:
            uid = args.uid.encode('ascii')
            if uid not in ids:
                raise SystemExit('Requested UID does not match the designated test search.')
        elif args.list_candidates or len(ids) != 1:
            for matching_uid in ids[-10:]:
                _, headers = client.uid('fetch', matching_uid, '(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE)])')
                header = BytesParser(policy=policy.default).parsebytes(b''.join(v[1] for v in headers if isinstance(v, tuple)))
                print(json.dumps({'uid': matching_uid.decode(), 'subject': str(header.get('Subject', '')), 'from': str(header.get('From', '')), 'date': str(header.get('Date', ''))}))
            raise SystemExit(f'Found {len(ids)} matching tests; select a specific UID.')
        else:
            uid = ids[0]
        status, size_data = client.uid('fetch', uid, '(RFC822.SIZE FLAGS)')
        size = re.search(rb'RFC822.SIZE (\d+)', b' '.join(v for v in size_data if isinstance(v, bytes)))
        if status != 'OK' or not size or int(size[1]) > 30 * 1024 * 1024:
            raise SystemExit('Unable to validate message size, or email exceeds 30 MB.')
        status, fetched = client.uid('fetch', uid, '(BODY.PEEK[])')
        if status != 'OK':
            raise SystemExit('Read-only fetch failed.')
        raw = b''.join(v[1] for v in fetched if isinstance(v, tuple))
        if not raw or len(raw) > 30 * 1024 * 1024:
            raise SystemExit('Invalid message size.')
        os.umask(0o077)
        with tempfile.TemporaryDirectory(prefix='test-mail-', dir=directory) as temporary:
            message = Path(temporary) / 'submission.eml'
            message.write_bytes(raw)
            result = subprocess.run(['node', 'scripts/intake.mjs', 'email', str(message), '--site', site_id], cwd=root, check=False)
            if result.returncode:
                raise SystemExit('Message fetched, but submission validation failed. Nothing published.')
        print('Designated message fetched with BODY.PEEK in read-only mode. No mail flags changed; no publication.')
    finally:
        try:
            client.logout()
        except (OSError, imaplib.IMAP4.error):
            pass


if __name__ == '__main__':
    try:
        main()
    except (imaplib.IMAP4.error, ssl.SSLError, OSError) as error:
        raise SystemExit(f'Mail check failed ({type(error).__name__}); credentials not displayed.')
