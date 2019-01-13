var express = require('express')
// var path = require('path')
// var serveStatic = require('serve-static')
var bodyParser = require('body-parser')
var cors = require('cors')
var request = require('request')
var querystring = require('querystring')
// var cookieParser = require('cookie-parser')


var generateRandomString = function(length) {
  var text = ''
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

var stateKey = 'spotify_auth_state'

var app = express()
app.use(bodyParser.json())
   .use(cors())

// app.use(serveStatic(__dirname + "/dist"))

var port = process.env.PORT || '8082'

let redirect_uri = undefined
let redirect_url

if (process.env.NODE_ENV === 'production') {
  var redirect = process.env.redirect
  redirect_uri = redirect
  redirect_url = redirect + '?'
  var client_id = process.env.client_id
  var client_secret = process.env.client_secret
  var bitly_access_token = process.env.bitly_access_token
} else {
  redirect_uri = 'http://localhost:8082/callback/'
  redirect_url = 'http://localhost:8081/?'
  bitly_redirect_uri = 'http://localhost:8082/bitly_callback/'
  var { client_id, client_secret, bitly_access_token } = require('./secrets')
}

app.get('/api', (req, res) => {
  res.json({message: 'Welcome to the Server'})
})

app.get('/login', function (req, res) {
  var state = generateRandomString(16)
  res.cookie(stateKey, state)

  var scope = 'user-read-private user-read-email user-top-read playlist-modify-public playlist-modify-private user-library-read user-library-modify'
  res.send('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      client_id: client_id,
      redirect_uri: redirect_uri,
      scope: scope,
      response_type: 'code',
      show_dialog: true,
      state: state
    }))
})

app.get('/callback', function(req, res) {
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;
  if (state === null) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    }

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        }

        request.get(options, function(error, response, body) {
          // console.log(body);
        })
        res.redirect(redirect_url +
          querystring.stringify({
            access_token: access_token,
            // refresh_token: refresh_token
          }))
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }))
      }
    })
  }
})

// app.get('/refresh_token', function(req, res) {
//
//   var refresh_token = req.query.refresh_token
//   var authOptions = {
//     url: 'https://accounts.spotify.com/api/token',
//     headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
//     form: {
//       grant_type: 'refresh_token',
//       refresh_token: refresh_token
//     },
//     json: true
//   }
//
//   request.post(authOptions, function(error, response, body) {
//     if (!error && response.statusCode === 200) {
//       var access_token = body.access_token
//       res.send({
//         'access_token': access_token
//       })
//     }
//   })
// })

app.get('/short_url', function(req, res) {
  const longUrl = encodeURIComponent(req.query.url)
  request.get(`https://api-ssl.bitly.com//v3/shorten?access_token=${bitly_access_token}&longUrl=${longUrl}/`,
    function(error, response, body) {
      res.send(body)
  })
})


app.listen(port, () => {
  console.log('API listening on port ' + port)
})
