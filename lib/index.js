'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_axios2.default.defaults.timeout = 60000; /**
                                           * @file: ajax api service
                                           * @author: zhangshaolong@didichuxing.com
                                           */

_axios2.default.defaults.headers['x-requested-with'] = 'XMLHttpRequest';
// axios.defaults.headers.post['Content-Type'] = 'application/json;charset=UTF-8'//'application/x-www-form-urlencoded'
var CancelToken = _axios2.default.CancelToken;

var ignoreMap = {};

var showLoading = function showLoading() {};

var hideLoading = function hideLoading() {};

var dealError = function dealError() {};

var checkStatus = function checkStatus(resp) {
  var code = resp.code;
  if (code === 302) {
    // to login
  } else if (code === 403) {
    // to auth
  } else if (code === 200 || code === 0) {
    return true;
  } else {
    return false;
  }
};

var RequestManager = function () {
  var requests = [];
  return {
    add: function add(promise) {
      requests.push(promise);
    },
    remove: function remove(promise) {
      for (var i = 0; i < requests.length; i++) {
        if (requests[i] === promise) {
          requests.splice(i, 1);
          return;
        }
      }
    },
    clear: function clear() {
      while (requests.length) {
        requests.pop().cancel();
      }
    }
  };
}();

_axios2.default.interceptors.response.use(function (response) {
  return response;
}, function (error) {
  if (!_axios2.default.isCancel(error)) {
    return dealError(error);
  } else {
    throw error;
  }
});

/**
 * the entrance for ajax api call
 * @param {string} path the url of api
 * @param {object} params the args for api
 * @param {object} object config ajax
 * @param {element} object.target loading mask the element
 */
var ajax = function ajax(path, params, options, type) {
  var cancel = void 0;
  var context = options.context;
  if (context) {
    showLoading(context);
  }

  var isSync = options.sync;

  var headers = options.headers;

  var timeout = options.timeout;

  var responseType = options.responseType || 'json';

  var promise = new Promise(function (resolve, reject) {
    var opts = {
      url: path,
      method: type,
      cancelToken: new CancelToken(function (canl) {
        cancel = canl;
      })
    };
    if (headers) {
      opts.headers = headers;
    }
    if (timeout) {
      opts.timeout = timeout;
    }
    opts.responseType = responseType;
    if (type === 'GET') {
      opts.params = params;
    } else {
      opts.data = params;
      opts.transformRequest = [function (data, config) {
        if (data) {
          if (config['Content-Type']) {
            if (config['Content-Type'].indexOf('application/x-www-form-urlencoded') < 0) {
              return JSON.stringify(data);
            }
          } else if (config.post['Content-Type'].indexOf('application/x-www-form-urlencoded') < 0) {
            return JSON.stringify(data);
          }
        }
        var str = '';
        for (var key in data) {
          str += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
        }
        if (str) {
          return str.substr(1);
        }
      }];
    }

    var doAjax = function doAjax(callback, ts) {
      var dealResponse = function dealResponse(resp) {
        if (context) {
          hideLoading(context);
          delete options.context;
        }
        var code = resp.code;
        if (code === 302) {
          // to login
        } else if (code === 403) {
          // to auth
        } else {
          if (checkStatus(resp)) {
            callback(true, resp, ts);
          } else {
            callback(false, resp, ts);
          }
        }
      };
      var dealException = function dealException(e) {
        if (context) {
          hideLoading(context);
          delete options.context;
        }
        if (!_axios2.default.isCancel(e)) {
          callback(false, e, ts);
        }
      };
      if (isSync) {
        // Implement a simple synchronization process, some headers not set, to be a problem
        var xhr = new XMLHttpRequest();
        var url = opts.url;
        if (type === 'GET') {
          var args = [];
          for (var key in params) {
            args.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
          }
          if (args.length) {
            url += '?' + args.join('&');
          }
        }
        if (timeout) {
          xhr.timeout = timeout;
        }
        xhr.open(type, url, false);
        var _headers = Object.assign({}, _axios2.default.defaults.headers[type.toLowerCase()]);
        for (var _key in _headers) {
          xhr.setRequestHeader(_key, _headers[_key]);
        }
        if (opts.headers) {
          for (var _key2 in opts.headers) {
            xhr.setRequestHeader(_key2, opts.headers[_key2]);
          }
        }
        if (type === 'POST') {
          xhr.send(opts.transformRequest[0](params, _axios2.default.defaults.headers));
        } else {
          xhr.send();
        }
        try {
          dealResponse(JSON.parse(xhr.responseText));
        } catch (e) {
          dealException(e);
        }
        RequestManager.remove(promise);
      } else {
        (0, _axios2.default)(opts).then(function (res) {
          dealResponse(res.data);
        }).catch(dealException).finally(function () {
          RequestManager.remove(promise);
        });
      }
    };

    var ignoreBefore = options.ignoreBefore;
    if (ignoreBefore) {
      path = path.split('?')[0];
      var checkResp = function checkResp(success, resp, ts) {
        if (ignoreContext.ts === ts) {
          ignoreContext = ignoreMap[path] = null;
          delete ignoreMap[path];
          success ? resolve(resp) : reject(resp);
        }
      };
      var ts = new Date().getTime();
      var ignoreDelay = options.ignoreDelay || 50;
      var ignoreContext = ignoreMap[path];
      if (!ignoreContext) {
        ignoreContext = {
          status: 'todo'
        };
        ignoreContext.timer = setTimeout(function () {
          doAjax(checkResp, ts);
          ignoreContext.status = 'doing';
        }, ignoreDelay);
      } else if (ignoreContext.status === 'todo') {
        clearTimeout(ignoreContext.timer);
        ignoreContext.timer = setTimeout(function () {
          doAjax(checkResp, ts);
          ignoreContext.status = 'doing';
        }, ignoreDelay);
      } else if (ignoreContext.status === 'doing') {
        doAjax(checkResp, ts);
      }
      ignoreContext.ts = ts;
    } else {
      doAjax(function (success, resp) {
        success ? resolve(resp) : reject(resp);
      });
    }
  });

  promise.cancel = function (msg) {
    cancel(msg);
  };

  RequestManager.add(promise);

  return promise;
};

exports.default = {
  config: function config(_config) {
    if (_config.showLoading) {
      showLoading = _config.showLoading;
    }
    if (_config.hideLoading) {
      hideLoading = _config.hideLoading;
    }
    if (_config.dealError) {
      dealError = _config.dealError;
    }
    if (_config.checkStatus) {
      checkStatus = _config.checkStatus;
    }
    if (_config.globalContextType) {
      _axios2.default.defaults.headers.post['Content-Type'] = _config.globalContextType;
    }
  },
  get: function get(path) {
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    return ajax(path, params, options, 'GET');
  },
  post: function post(path) {
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    return ajax(path, params, options, 'POST');
  },
  jsonp: function jsonp(path) {
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    var callbackKey = options.callbackKey || 'callback';
    var script = document.createElement('script');
    document.body.appendChild(script);

    var funName = 'cb' + new Date().getTime() + '_' + ('' + Math.random()).substr(2, 8);
    var promise = new Promise(function (resolve, reject) {
      window[funName] = function (resp) {
        resolve(resp);
        document.body.removeChild(script);
        window[funName] = null;
        delete window[funName];
      };
      script.onerror = function (e) {
        reject(e.message);
        document.body.removeChild(script);
        window[funName] = null;
        delete window[funName];
      };
      path += (path.indexOf('?') > -1 ? '&' : '?') + (callbackKey + '=' + funName);
      var querys = '';
      for (var key in params) {
        querys += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
      script.src = path + querys;
    });
    return promise;
  },
  clear: function clear() {
    RequestManager.clear();
  }
};