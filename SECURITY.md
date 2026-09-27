# Security policy

## Reporting a vulnerability

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Please do not open a public issue for a security problem.

A confirmed problem is fixed in a new release, and the advisory is published once the fix is on npm.

## Supported versions

Only the latest major version (2.x) gets security fixes.

## What this package is not

It fetches public posts from the Stack Exchange API and returns their markdown as the API gives it: it does not render, sanitise or escape that markdown (which can hold HTML and HTML entities), so treat it as untrusted text. The API key you pass is sent in the query string of an HTTPS request to api.stackexchange.com, as the API requires; the package never puts it in an error message.
