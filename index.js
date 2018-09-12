/**
 * @file: ajax api service
 * @author: zhangshaolong@didichuxing.com
 */

import axios from 'axios'

axios.defaults.timeout = 60000
axios.defaults.headers['x-requested-with'] = 'XMLHttpRequest'
// axios.defaults.headers.post['Content-Type'] = 'application/json;charset=UTF-8'//'application/x-www-form-urlencoded'
const CancelToken = axios.CancelToken

let ignoreMap = {}

let showLoading = () => {}

let hideLoading = () => {}

let dealError = () => {}

let checkStatus = (resp) => {
  let code = resp.code
  if (code === 302) {
    // to login
  } else if (code === 403) {
    // to auth
  } else if (code === 200 || code === 0) {
    return true
  } else {
    return false
  }
}

axios.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (!axios.isCancel(error)) {
      return dealError(error)
    } else {
      throw error
    }
  }
)

/**
 * the entrance for ajax api call
 * @param {string} path the url of api
 * @param {object} params the args for api
 * @param {object} object config ajax
 * @param {element} object.target loading mask the element
 */
const ajax = (path, params, options, type) => {
  let cancel
  let context = options.context
  if (context) {
    showLoading(context)
  }

  let isSync = options.sync

  let headers = options.headers

  const promise = new Promise((resolve, reject) => {
    let opts = {
      url: path,
      method: type,
      cancelToken: new CancelToken((canl) => {
        cancel = canl
      })
    }
    if (headers) {
      opts.headers = headers
    }
    if (type === 'GET') {
      opts.params = params
    } else {
      opts.data = params
      opts.transformRequest = [
        (data, config) => {
          if (
            data &&
            config.post['Content-Type'].indexOf(
              'application/x-www-form-urlencoded'
            ) > -1
          ) {
            let str = ''
            for (let key in data) {
              str +=
                '&' +
                encodeURIComponent(key) +
                '=' +
                encodeURIComponent(data[key])
            }
            if (str) {
              return str.substr(1)
            }
          }
          return JSON.stringify(data)
        }
      ]
    }

    const doAjax = (callback, ts) => {
      const dealResponse = (resp) => {
        if (context) {
          hideLoading(context)
          delete options.context
        }
        let code = resp.code
        if (code === 302) {
          // to login
        } else if (code === 403) {
          // to auth
        } else {
          if (checkStatus(resp)) {
            callback(true, resp, ts)
          } else {
            callback(false, resp, ts)
          }
        }
      }
      const dealException = (e) => {
        if (context) {
          hideLoading(context)
          delete options.context
        }
        if (!axios.isCancel(e)) {
          callback(false, e, ts)
        }
      }
      if (isSync) { // Implement a simple synchronization process, some headers not set, to be a problem
        let xhr = new XMLHttpRequest()
        let url = opts.url
        if (type === 'GET') {
          let args = []
          for (let key in params) {
            args.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
          }
          if (args.length) {
            url += '?' + args.join('&')
          }
        }
        xhr.open(type, url, false)
        let headers = Object.assign({}, axios.defaults.headers[type.toLowerCase()])
        for (let key in headers) {
            xhr.setRequestHeader(key, headers[key])
          }
        if (opts.headers) {
          for (let key in opts.headers) {
            xhr.setRequestHeader(key, opts.headers[key])
          }
        }
        if (type === 'POST') {
          xhr.send(opts.transformRequest[0](params, axios.defaults.headers))
        } else {
          xhr.send()
        }
        try {
          dealResponse(JSON.parse(xhr.responseText))
        } catch (e) {
          dealException(e)
        }
      } else {
        axios(opts).then((res) => {
          dealResponse(res.data)
        }).catch(dealException)
      }
    }

    let ignoreBefore = options.ignoreBefore
    if (ignoreBefore) {
      path = path.split('?')[0]
      const checkResp = (success, resp, ts) => {
        if (ignoreContext.ts === ts) {
          ignoreContext = ignoreMap[path] = null
          delete ignoreMap[path]
          success ? resolve(resp) : reject(resp)
        }
      }
      let ts = new Date().getTime()
      let ignoreDelay = options.ignoreDelay || 50
      let ignoreContext = ignoreMap[path]
      if (!ignoreContext) {
        ignoreContext = {
          status: 'todo'
        }
        ignoreContext.timer = setTimeout(() => {
          doAjax(checkResp, ts)
          ignoreContext.status = 'doing'
        }, ignoreDelay)
      } else if (ignoreContext.status === 'todo') {
        clearTimeout(ignoreContext.timer)
        ignoreContext.timer = setTimeout(() => {
          doAjax(checkResp, ts)
          ignoreContext.status = 'doing'
        }, ignoreDelay)
      } else if (ignoreContext.status === 'doing') {
        doAjax(checkResp, ts)
      }
      ignoreContext.ts = ts
    } else {
      doAjax((success, resp) => {
        success ? resolve(resp) : reject(resp)
      })
    }
  })

  promise.cancel = (msg) => {
    cancel(msg)
  }
  return promise
}

export default {
  config: (config) => {
    if (config.showLoading) {
      showLoading = config.showLoading
    }
    if (config.hideLoading) {
      hideLoading = config.hideLoading
    }
    if (config.dealError) {
      dealError = config.dealError
    }
    if (config.checkStatus) {
      checkStatus = config.checkStatus
    }
  },
  get: (path, params = {}, options = {}) => {
    return ajax(path, params, options, 'GET')
  },
  post: (path, params = {}, options = {}) => {
    return ajax(path, params, options, 'POST')
  },
  jsonp: (path, params = {}, options = {}) => {
    let callbackKey = options.callbackKey || 'callback'
    const script = document.createElement('script')
    document.body.appendChild(script)

    const funName = 'cb' + new Date().getTime() + '_' + ('' + Math.random()).substr(2, 8)
    const promise = new Promise((resolve, reject) => {
      window[funName] = (resp) => {
        resolve(resp)
        document.body.removeChild(script)
        window[funName] = null
        delete window[funName]
      }
      script.onerror = (e) => {
        reject(e.message)
        document.body.removeChild(script)
        window[funName] = null
        delete window[funName]
      }
      path += (path.indexOf('?') > -1 ? '&' : '?') + `${callbackKey}=${funName}`
      let querys = ''
      for (let key in params) {
        querys += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
      }
      script.src = path + querys
    })
    return promise
  }
}
