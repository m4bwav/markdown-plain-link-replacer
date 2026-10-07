# Security policy

## Reporting a problem

Open an issue or a pull request, or start a thread in [Discussions](https://github.com/m4bwav/markdown-plain-link-replacer/discussions) and I'll take a look. You can also report privately: open the repository's **Security** tab and choose **Report a vulnerability**.

A confirmed problem is fixed in a new release, and the advisory is published once the fix is on npm.

## Supported versions

Only the latest major version (2.x) gets security fixes.

## What this package is not

It requests every http and https link it finds in the text it is given (two GET requests at most per link, each with the timeout), from the machine it runs on. Links to `localhost` and private addresses are requested too, so running it on untrusted text inside a network with internal services lets that text make requests there. Only the page's title is used, never the body's other content. There is no allow-list that makes this safe, because a public page can redirect to a private one: run it on text you trust, or where those requests reach nothing that matters.

The titles it writes come from other people's pages. The default template escapes the markdown characters that could break the link or add formatting, but the result is markdown, not sanitised HTML: render it as you would any untrusted markdown.

Link scanning takes linear time in the size of the text.
