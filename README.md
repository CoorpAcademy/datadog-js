# datadog-js

***:warning: README to be UPDATED with DATADOG MIGRATION :warning:***

> Link to the [Logmatic.io documentation](http://doc.logmatic.io/docs/javascript-clients-web-browsers)

Client-side JavaScript logging library for *Datadog* based on the [Logmatic.io](https://logmatic.io) one.


## Features

- Use the library as a logger. Everything is forwarded to Logmatic.io as JSON documents.
- Metas and extra attributes
- Forward every JavaScript errors (optional)
- Forward JavaScript's console logs (optional)
- Track real client IP address and user-agent (optional)
- Automatic bulk posts (default to 500ms linger delay and 10 messages max per POST)
- Small minified script < 2kb

## Quick Start

### Load and initialize logger

You simply have to include the minified script and initialize it with your write API key that can be found on your *Datadog platform.

```html
<html>
  <head>
    <title>Example to send logs to Logmatic.io</title>
    <script type="text/javascript" src="<path_to_tracekit>/tracekit/tracekit.js"></script> //OPTIONAL but provides better error handling
    <script type="text/javascript" src="<path_to_logmatic>/src/logmatic.min.js"></script>
    <script>
      // Set your API key
      logmatic.init('<your_api_key>');

      // OPTIONAL init methods
      // add some meta attributes in final JSON
      logmatic.setMetas({'userId': '1234'});
      // fwd any error using 'error' as JSON attr
      logmatic.setSendErrors('error');
      // fwd any console log using 'severity' as JSON attr
      logmatic.setSendConsoleLogs('severity');
      // resolve client IP and copy it @ 'client.IP'
      logmatic.setIPTracking('client.IP');
      // resolve client UA and copy it @ 'client.user-agent'
      logmatic.setUserAgentTracking('client.user-agent');
      // resolve URL and copy it @ 'url'
      logmatic.setURLTracking('url');
      // Default bulking setting - OPTIONAL modifications allowed
      logmatic.setBulkOptions({ lingerMs: 500, maxPostCount: 10, maxWaitingCount: -1 })
	</script>
    ...
  </head>
...
</html>
```

#### Using npm:

```
npm install --save tracekit@0.3.1 //OPTIONAL TraceKit is optional but it provides better error handling
npm install --save logmatic/logmatic-js#master
```

```javascript
// commonjs
var TraceKit = require('tracekit'); //OPTIONAL but provides better error handling
var logmatic = require('logmatic-js');

// ES2015
// import TraceKit from 'tracekit'; //OPTIONAL but provides better error handling
// import logmatic from 'logmatic-js';

// Set your API key
logmatic.init('<your_api_key>');
// ...
// same as before
```

### Handling of errors

You can handle errors by calling the `setSendErrors` initialization method. By default, logmatic-js catches all the errors from `window.onerror`.

However, we **advise you to use TraceKit** which is automatically recognized by logmatic-js and takes precedence over the former method.
[TraceKit](https://github.com/csnover/TraceKit) gives you:
- Stack traces when errors are properly fired
- Resolves source maps for minified files
- Resolves name of the method & add context

Please read their documentation for more details and options.

### Log some events

#### Fire your own events

To log some events you simply there is simple an unique method called *log(<message>,<context>)*. The message is a piece of text, the context is an object that you want to associate to the message.

```html
...
<script>
...
logmatic.log('Button clicked', { name: 'My button name' });
...
</script>
...
```

To clearly explain what happens here, in this exact situation where everything is configured as above the API POSTs the following JSON content to *Logmatic.io*'s API.:

```
{
  "severity": "info",
  "userId: "1234",
  "name": "My button name",
  "message": "Button clicked",
  "url": "...",
  "client": {
    "IP" : "109.30.xx.xxx",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.130 Safari/537.36"
  }
}
```

#### Automatic handling of errors

When `setSendErrors` init method is invoked with **TraceKit** enabled. Errors should be reported has this example below:

```
{
    "severity": "error",
    "client": {
      "IP": "109.30.xx.xxx",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36"
    },
    "message": "This is a fake error!!",
    "userId": "1234",
    "url": "../logmatic-js/test/test-client.html",
    "error": {
      "mode": "stack",
      "name": "Error",
      "message": "This is a fake error!!",
      "stack": [
        {
          "args": [],
          "func": "bar",
          "line": 32,
          "column": 15,
          "context": {},
          "url": "../logmatic-js/test/test-client.html"
        },
        {
          "args": [],
          "func": "foo",
          "line": 28,
          "column": 9,
          "context": {},
          "url": "../logmatic-js/test/test-client.html"
        },
        ... And more...
      ]
    }
  }
```

### Try the `test-client.html` page

In `test/`, you'll find a test html page called `test-client.html` you can use to make some quick test.
We encourage you to have a look at it as you'll be able to shoot a some log events in a few seconds.

Just don't forget to set your own API key.

## API

You must call the init method to configure the logger:
```
logmatic.init(<your_api_key>);
```

There are one method for each level to send log events to *Logmatic.io*:
```
logmatic.log(<message>,<context>, <severity>);
logmatic.error(<message>,<context>);
logmatic.warn(<message>,<context>);
logmatic.info(<message>,<context>);
logmatic.debug(<message>,<context>);
logmatic.trace(<message>,<context>);
```

You can also use all the following parameters using the right method:

| Method        | Description           |  Example  |
| ------------- | ------------- |  ----- |
| setMetas(object) | add some meta attributes in final JSON | `.setMetas({ 'userId': '1234' })` |
| addMeta(key, value) | add some meta attributes in final JSON | `.addMeta("userEmail", "foo@example.com")` |
| setSendErrors(exception_attr) | fwd any error using exception_attr as JSON attr | `.setSendErrors('error');`|
| setSendConsoleLogs(level_attr) | fwd any console log using level_attr" as JSON attr | `.setSendConsoleLogs('level')`|
| setIPTracking(ip_attr) | resolve client IP and the "ip_attr" field to the event | `.setIPTracking('client.IP')`|
| setUserAgentTracking(ua_attr) | resolve client UA and the "ua_attr" field to the event | `.setUserAgentTracking('client.user-agent')`|
| setURLTracking(url_attr) | resolve URL and the "url_attr" field to the event | `.setURLTracking('url')`|
| setBulkOptions({ lingerMs: duration_in_ms, maxPostCount: count, maxWaitingCount: count }) | Options to configure the bulking behavior. Bulking limits the number of requests emitted. | `.setBulkOptions({ lingerMs: 500, maxPostCount: 10, maxWaitingCount: -1 })`|
| | lingerMs: A delay used to give a change to bulk a few line of logs together |
| | maxPostCount: How many log lines should each post send at most (-1 no limit) |
| | maxWaitingCount: How many log lines can be queued before dropping some (-1 no limit) |


## FAQ

### How to force a custom endpoint URL?
You can override the default URL with the `logmatic.forceEndpoint('https://A_CUSTOM_URL')` method. Notice, this method
ignores the `key` set via the `logmatic.init('API_KEY')` method.
