"""Read-only Bridge connection check; never logs credentials or message contents."""
import argparse
import hashlib
import imaplib
import json
import os
from pathlib import Path
import ssl
import subprocess


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trust-local-certificate', action='store_true')
    parser.add_argument('--expected-fingerprint', help='Independently verified SHA-256 certificate fingerprint')
    args = parser.parse_args()
    directory = Path(__file__).resolve().parents[1] / '.private' / 'mail'
    config_path = directory / 'bridge.json'
    if config_path.stat().st_mode & 0o077:
        raise SystemExit('Credential file must have owner-only permissions.')
    config = json.loads(config_path.read_text())
    if config['host'] != '127.0.0.1' or config['port'] != 1143:
        raise SystemExit('This checker is restricted to local Proton Bridge on port 1143.')
    certificate = directory / 'bridge-ca.pem'
    if args.trust_local_certificate:
        if certificate.exists():
            raise SystemExit('Certificate already pinned; refusing to replace it automatically.')
        result = subprocess.run(['openssl', 's_client', '-starttls', 'imap', '-connect', '127.0.0.1:1143', '-showcerts'], input='', capture_output=True, text=True, timeout=20)
        begin = result.stdout.index('-----BEGIN CERTIFICATE-----')
        end = result.stdout.index('-----END CERTIFICATE-----', begin) + len('-----END CERTIFICATE-----')
        pem = result.stdout[begin:end] + '\n'
        fingerprint = hashlib.sha256(ssl.PEM_cert_to_DER_cert(pem)).hexdigest()
        # Match the certificate independently inspected on this machine before enrollment.
        expected = (args.expected_fingerprint or '').replace(':', '').lower()
        if fingerprint != expected:
            raise SystemExit('Certificate changed since inspection; manual review required.')
        fd = os.open(certificate, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as output:
            output.write(pem)
        print('Pinned inspected local Bridge certificate for this integration only.')
    context = ssl.create_default_context(cafile=str(certificate))
    client = imaplib.IMAP4(config['host'], config['port'], timeout=20)
    try:
        client.starttls(ssl_context=context)
        client.login(config['username'], config['password'])
        print('TLS certificate verified; Bridge login successful.')
        folder = config['folder']
        if any(c in folder for c in ['"', '\\', '\r', '\n']):
            raise SystemExit('Unsupported folder characters.')
        for candidate in [folder, 'Folders/' + folder]:
            status, data = client.select('"' + candidate + '"', readonly=True)
            if status == 'OK':
                print('Publishing folder:', candidate)
                print('Message count:', int(data[0]))
                print('Read-only connection verified. No messages fetched, changed, or published.')
                return
        raise SystemExit('Configured publishing folder not found. Create it in Proton Mail, then retry.')
    finally:
        try:
            client.logout()
        except (OSError, imaplib.IMAP4.error):
            pass


if __name__ == '__main__':
    try:
        main()
    except (imaplib.IMAP4.error, ssl.SSLError, OSError) as error:
        raise SystemExit(f'Connection check failed ({type(error).__name__}); credentials were not displayed.')
