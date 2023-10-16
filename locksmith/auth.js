const { config } = require('dotenv');
const { expand } = require('dotenv-expand');
const debug = require('debug');
const path = require('path');

expand(config());
expand(
  config({
    path: path.resolve(process.cwd(), ".env"),
    override: true,
  })
);

const debugLocksmith = debug('locksmith');

debugLocksmith(path.resolve(process.cwd(), '.env'));


var express = require('express')
var app = express()
const port = process.env.LOCKSMITH_PORT;

var ClientOAuth2 = require('client-oauth2');

const { LOCKSMITH_CLIENT_ID, LOCKSMITH_CLIENT_SECRET, LOCKSMITH_ORIGIN } = process.env;

debugLocksmith({
  LOCKSMITH_CLIENT_ID,
  LOCKSMITH_CLIENT_SECRET,
  LOCKSMITH_ORIGIN,
});

var dcpOAuth = new ClientOAuth2({
  clientId: LOCKSMITH_CLIENT_ID,
  clientSecret: LOCKSMITH_CLIENT_SECRET,
  accessTokenUri: `${LOCKSMITH_ORIGIN}/oauth/token`,
  authorizationUri: `${LOCKSMITH_ORIGIN}/oauth/authorize`,
  redirectUri: `${LOCKSMITH_ORIGIN}/locksmith/`,
  scopes: ['login']
});

const fs = require('fs');

let proxyAppPath = "/locksmith";
app.use(function (req, res, next) {
  req.originalUrl = proxyAppPath + req.url;
  next();
})

app.set('view engine', 'ejs');
app.set('views', __dirname);

app.get('/', function (req, res) {
  if(req.query.code) { 
    try {
      dcpOAuth.code.getToken(req.originalUrl)
      .then(function (user) {
        try {
          // needed to extract keystore address (currently easier to this here than in frame.html)
          const ks = JSON.parse(user.data.keystore);
          const userData = {
            token: user.accessToken,
            keystore: user.data.keystore,
            proxy: ks.address,
            email: user.data.email,
          }

          return res.render('frame', {
            userData,
            lang: 'en',
            scheduler: process.env.LOCKSMITH_SCHEDULER_HREF,
            locale: 'pringle-y',
          });
        } catch (e){
          console.log(e);
          res.status(500).send('Internal Server Error (render)');
          console.error('Internal Server Error (render)');
        }
      })
      .catch((error) => {
        console.log(error);
        res.status(500).send('Internal Server Error (token retrieval)');
        console.error('Internal Server Error (token retrieval)');
      });
    } catch {
      res.status(500).send('Internal Server Error (token retrieval)');
      console.error('Internal Server Error (token retrieval)');
    }
  }
  else
  {
    try {
      const uri = dcpOAuth.code.getUri();
      res.redirect(uri);
    } catch {
      res.status(500).send('Internal Server Error (redirect)');
      console.error('Internal Server Error (redirect)');
    }
  }
});

app.listen(port, () => {
  console.log(`Oauth Locksmith listening at http://localhost:${port}`)
});
