# Security

Do not post secrets or sensitive logs in public issues. Report vulnerabilities privately to the repository owner through their available private contact or GitHub private vulnerability reporting if enabled. Rotate any exposed credentials immediately through the issuing service.

This is a trusted-audience hackathon prototype. Shared assistant tokens do not enforce each Jenkins user's RBAC. Log redaction and prompt-injection defenses are best-effort. Keep the backend on loopback, restrict the Jenkins reader's scope, inspect log previews, and use SSH forwarding or authenticated TLS access. No automatic remediation or deployment is implemented.
