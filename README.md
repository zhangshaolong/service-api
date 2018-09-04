# service api tool
ajax request and response a promise

    install
    npm install service-api --save

```javascript
  import service from 'service-api'

  // could set config
  service.config({
    showLoading: () => { to show loading },
    hideLoading: () => { to hide loading },
    dealError: (error) => {
      deal some error
    }
  })

  service.get(path, {key: 'value'}, {
    context: document.body
  }).then((resp) => {

  }).catch((error) => {

  })

  service.post(path, {key: 'value'}, {
    context: document.body
  }).then((resp) => {
    
  }).catch((error) => {

  })
```javascript

