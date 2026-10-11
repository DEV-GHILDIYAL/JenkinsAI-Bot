"""Run as root on EC2 to verify the private JenkinsAI integration without printing secrets."""

import base64
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


env = {}
for line in Path('/etc/jenkinsai.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        key, value = line.split('=', 1)
        env[key] = value

basic = base64.b64encode(f"{env['JENKINS_USER']}:{env['JENKINS_API_TOKEN']}".encode()).decode()


def check(label, url, headers=None, body=None, expected=200):
    request = Request(url, headers=headers or {}, data=body)
    try:
        with urlopen(request, timeout=120) as response:
            status = response.status
            data = response.read()
    except HTTPError as error:
        status = error.code
        data = error.read()
    print(f'{label}: HTTP {status}')
    assert status == expected, f'{label}: expected {expected}'
    return data


reader = {'Authorization': f'Basic {basic}'}
assistant = {'Authorization': f"Bearer {env['ASSISTANT_TOKEN']}"}
check('Gateway Jenkins', 'http://127.0.0.1:8090/login')
check('Gateway assistant', 'http://127.0.0.1:8090/assistant/health')
check('Reader Jenkins jobs', 'http://127.0.0.1:8080/api/json?tree=jobs[name]', reader)
check('Reader build logs', 'http://127.0.0.1:8080/job/jenkins-ai-demo/1/consoleText', reader)
check('Reader cannot access config', 'http://127.0.0.1:8080/job/jenkins-ai-demo/config.xml', reader, expected=403)
jobs = json.loads(check('Assistant jobs', 'http://127.0.0.1:8000/api/jobs', assistant))
assert any(job['name'] == 'jenkins-ai-demo' for job in jobs['jobs'])
monitor = json.loads(check('Assistant monitor', 'http://127.0.0.1:8000/api/monitor', assistant))
print('Monitor:', 'jobs', monitor['job_count'], 'events',
      [(event['kind'], event['build'], event['result']) for event in monitor['events']])
chat_headers = {**assistant, 'Content-Type': 'application/json'}
chat_body = json.dumps({'messages': [{'role': 'user', 'content': 'Why did this Jenkins build fail? Cite one log line.'}], 'job': 'jenkins-ai-demo', 'build': 1, 'share_logs': True}).encode()
chat = json.loads(check('Gemma chat', 'http://127.0.0.1:8000/api/chat', chat_headers, chat_body))
assert chat['answer'].strip() and chat['demo'] is False
print('Live Jenkins reader, gateway, monitor, and Gemma verified.')
