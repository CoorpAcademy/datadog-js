(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.logmatic = factory();
  }
}(this, function () {

  var _url = 'https://api.logmatic.io/v1/input/';
  var _metas;
  var _ipTrackingAttr;
  var _uaTrackingAttr;
  var _urlTrackingAttr;
  var _levelAttr = "severity";

  //Bulk default options
  var _bulkLingerMs = 500;
  var _bulkMaxPostCount = 10;
  var _bulkMaxWaitingCount = -1;


  var _queue = [];
  var _maxContentSize = 200 * 1024; // limit post to 200 KB

  var _lingerManager = createLingerManager(_bulkLingerMs);


  function assign(fromObject, toObject) {
    if (fromObject) {
      for (var key in fromObject) {
        if (fromObject.hasOwnProperty(key)) {
          toObject[key] = fromObject[key];
        }
      }
    }
  }


  function createLingerManager(lingerPeriodMs) {

    var manager = {};
    manager.MODE = {
      IMMEDIATE: 0,
      LINGER: 1,
      ERROR: 2
    };

    // constant values
    var _backOffPeriodMs = 500;
    var _backOffMaxPeriodMs = 30 * 1000;

    var _alarm = null;
    var _mode = manager.MODE.LINGER;
    var _backOffFactor = 0;
    var _lingerPeriodMs = lingerPeriodMs;


    manager.reset = function () {

      if (manager.isScheduled()) {
        clearTimeout(_alarm);
      }
      _alarm = null;
    };


    manager.isScheduled = function () {
      return _alarm !== null;
    };

    manager.setMode = function (mode) {
      _mode = mode;
      if (_mode !== manager.MODE.ERROR) {
        // reset the back-off factor
        _backOffFactor = 0;
      }
    };

    manager.postpone = function (_callback) {

      var timeMs;

      manager.reset();


      switch (_mode) {

        case manager.MODE.IMMEDIATE:
          timeMs = 0;
          break;

        case manager.MODE.LINGER:
          timeMs = _lingerPeriodMs;
          break;

        case manager.MODE.ERROR:
          var backOffPeriodMs = _backOffPeriodMs * Math.pow(2, _backOffFactor);
          _backOffFactor++;
          timeMs = Math.min(backOffPeriodMs, _backOffMaxPeriodMs);
      }

      // Defer the callback
      _alarm = setTimeout(_callback, timeMs);

    };

    return manager;
  }


  var init = function (key) {
    _url = _url + key;
  };

  var forceEndpoint = function (url) {
    _url = url;
  };

  var setBulkOptions = function (opts) {
    opts = opts || {};
    if (opts.lingerMs != null && opts.lingerMs >= 0) {
      _bulkLingerMs = opts.lingerMs;
    }
    if (opts.maxPostCount != null) {
      if (opts.maxPostCount < 1) opts.maxPostCount = 1;
      _bulkMaxPostCount = opts.maxPostCount;
    }
    if (opts.maxWaitingCount != null) {
      _bulkMaxWaitingCount = opts.maxWaitingCount;
    }
    if (opts.maxContentSize != null) {
      _maxContentSize = opts.maxContentSize;
    }
  };

  var trace = function (message, context) {
    log(message, context, "trace")
  };

  var debug = function (message, context) {
    log(message, context, "debug")
  };

  var info = function (message, context) {
    log(message, context, "info")
  };

  var warn = function (message, context) {
    log(message, context, "warn")
  };

  var error = function (message, context) {
    log(message, context, "error")
  };

  var log = function (message, context, severity) {
    if (!_url) {
      return;
    }
    var payload = {
      message: message
    };
    if (severity) {
      payload[_levelAttr] = severity
    } else {
      payload[_levelAttr] = "info";
    }
    assign(context, payload);
    queue(payload);
  };

  var queue = function (payload) {
    // Set metas
    assign(_metas, payload);

    // URL tracking
    if (_urlTrackingAttr) {
      payload[_urlTrackingAttr] = window.location.href;
    }

    _queue = _queue || [];
    _queue.push(_stringify(payload));

    // Check if we are growing above the max waiting count (if any)
    if (_bulkMaxWaitingCount >= 0 && _queue.length > _bulkMaxWaitingCount) {
      _queue.shift();
    }

    tryPost();
  };

  var tryPost = function () {

    // Do nothing if the linger already scheduled or if a post is running
    if (_lingerManager.isScheduled()) {
      return;
    }

    _lingerManager.postpone(post);


  };

  var post = function () {


    var data = [];
    var contentSize = 0;

    function handleExit(status) {


      if (status === 200 || status === 0) {

        if (_queue.length > 0) {
          // continue until the queue is empty
          _lingerManager.setMode(_lingerManager.MODE.IMMEDIATE);
        } else {
          // default mode
          _lingerManager.setMode(_lingerManager.MODE.LINGER);
        }
      } else {
        // use a back-off mechanism
        _lingerManager.setMode(_lingerManager.MODE.ERROR);
      }

      _lingerManager.reset();

      if (_queue.length !== 0) {
        tryPost();
      }

    }

    while (_queue.length > 0 && data.length < _bulkMaxPostCount) {
      var item = _queue.shift();
      contentSize += item.length;

      if (contentSize > _maxContentSize) {
        // Drop the element if its size is more than the max allowed, but warn the user
        if (item.length > _maxContentSize) {
          var newItem = {
            "severity": "warn",
            "message": "Message dropped as its size exceeded the hard limit of " + _maxContentSize + " kBytes"
          };
          assign(_metas, newItem);
          newItem[_urlTrackingAttr] = window.location.href;
          item = _stringify(newItem);
        }
        // the warn will be send with the next tick/post/call
        _queue.unshift(item);
        break;
      }
      data.push(item)
    }

    // Worst-case: the first element was too big
    if (data.length === 0) {
      handleExit(0);
      return;
    }

    var payload = '[' + data.join(',') + ']';

    var request;
    if (typeof (XDomainRequest) !== 'undefined') { // IE8/9
      request = new XDomainRequest();
    } else {
      request = new XMLHttpRequest();
    }
    request.open('POST', _url, true);

    if (typeof (XDomainRequest) === 'undefined') {
      request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

      // IP tracking
      if (_ipTrackingAttr) {
        request.setRequestHeader('X-Logmatic-Add-IP', _ipTrackingAttr);
      }
      // UserAgent tracking
      if (_uaTrackingAttr) {
        request.setRequestHeader('X-Logmatic-Add-UserAgent', _uaTrackingAttr);
      }
    }

    request.onerror = function (response) {
      handleExit(response.target.status);
    };

    request.onload = function (response) {
      handleExit(response.target.status);
    };


    request.send(payload);

  };

  var setMetas = function (metas) {
    _metas = metas;
  };

  var addMeta = function (key, value) {
    _metas[key] = value;
  };

  function setSendConsoleLogs(consoleLevelAttribute) {
    if (consoleLevelAttribute) {
      _levelAttr = consoleLevelAttribute;
    }
    if (!console) {
      return;
    }
    [{f: 'log', l: 'info'}, {f: 'info'}, {f: 'trace'}, {f: 'warn'}, {f: 'error'}].forEach(function (decl) {
      var funName = decl.f;
      var level = decl.l || decl.f;
      var oldFun = console[funName];
      console[funName] = function () {
        var props = null;
        // Set the level if requested
        if (_levelAttr) {
          props = {};
          props[_levelAttr] = level;
        }
        // Now we build the message and log it
        var message = Array.prototype.slice.call(arguments).map(function (a) {
          return typeof (a) === 'object' ? _stringify(a) : String(a);
        }).join(' ');
        log(message, props);
        // Fwd call to old impl.
        if (oldFun.apply) { // Most browsers
          oldFun.apply(console, arguments);
        } else { // IE
          oldFun(message);
        }
      };
    });
  }

  function setSendErrors(errorAttribute) {
    if (errorAttribute) {

      //Use TraceKit if available, fallback on basic error reporting otherwise
      var TraceKit = window.TraceKit;
      if (TraceKit) {
        TraceKit.report.subscribe(function (errorReport) {
          var errorProperties = {};
          errorProperties[errorAttribute] = errorReport;
          if (_levelAttr) {
            errorProperties[_levelAttr] = "error";
          }
          log(errorReport.message, errorProperties);
        });
      } else {
        var oldhandler = window.onerror;
        window.onerror = function (message, url, line, column, error) {
          var errorProperties = {};
          errorProperties[errorAttribute] = {
            mode: 'JSException',
            url: url,
            line: line,
            column: column
          };

          if (_levelAttr) {
            errorProperties[_levelAttr] = "error";
          }
          log(message, errorProperties);
          if (oldhandler && (typeof(oldhandler) === 'function')) {
            oldhandler.apply(window, arguments);
          }
        };
      }
    }
  }

  var setURLTracking = function (urlTrackingAttr) {
    _urlTrackingAttr = urlTrackingAttr;
  };

  var setIPTracking = function (ipTrackingAttr) {
    _ipTrackingAttr = ipTrackingAttr;
  };

  var setUserAgentTracking = function (uaTrackingAttr) {
    _uaTrackingAttr = uaTrackingAttr;
  };

  return {
    init: init,
    log: info,
    trace: trace,
    debug: debug,
    info: info,
    warn: warn,
    error: error,
    forceEndpoint: forceEndpoint,
    setMetas: setMetas,
    addMeta: addMeta,
    setSendErrors: setSendErrors,
    setSendConsoleErrors: setSendErrors,
    setSendConsoleLogs: setSendConsoleLogs,
    setIPTracking: setIPTracking,
    setUserAgentTracking: setUserAgentTracking,
    setURLTracking: setURLTracking,
    setBulkOptions: setBulkOptions
  };


  // tooling methods
  function _stringify(obj, replacer, spaces, cycleReplacer) {
    var serializer = function (replacer, cycleReplacer) {
      var stack = [], keys = [];

      if (cycleReplacer == null) cycleReplacer = function (key, value) {
        if (stack[0] === value) return "[Object Parent]"
        return "[Object Parent] " + keys.slice(0, stack.indexOf(value)).join(".")
      };

      return function (key, value) {
        if (stack.length > 0) {
          var thisPos = stack.indexOf(this);
          ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
          ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
          if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value)
        }
        else stack.push(value);

        return replacer == null ? value : replacer.call(this, key, value)
      }
    };
    return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
  }


}))
;