# Setup

## Locksmith Setup

Locksmith is used for generating api keys. It's setup is copied from the reflector app in dcp-auth. 
You will need to register locksmith as a new doorkeeper app with the following properties:
```yaml
name: locksmith
RedirectURI: http://oauth.bestia.office.distributive.network/locksmith/
Confidential: true
Scopes: login
Proxy:
Addr:
Portal:false
```
You will also need to add the following to your nginx config. I added it to dcp-auth.conf:
```
server {
  listen 80;
  listen [::]:80;

  server_name oauth.bestia.office.distributive.network;

  location /reflector/ {
    proxy_pass http://localhost:3711/;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_redirect off;
  }

  location /locksmith/ {
    proxy_pass http://localhost:3737/;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_redirect off;
  }

  location / {
      proxy_pass http://localhost:3710/;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Host $http_host;
      proxy_redirect off;
  }
}
```


