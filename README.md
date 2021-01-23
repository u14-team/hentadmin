# HentAdmin
This is HentAdmin

Use it in screen or other process manager.

## config.json
```js
{
  "port": 10001,
  "sessionLife": 3600,
  "database": "sqlite:./ha.sqlite3",
  "vkToken": "your page VK token",
  "botsDir": "/home/myUser/bots"
}
```

**Test it from [HentAdmin Web](https://u14-team.github.io/hentadmin-web/)**
## NGINX config
**HA Web requires https. This config redirect requests from your https domain to hentadmin backend.**
```
  location /rtc/ {
    proxy_pass http://localhost:10001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;

  }

  location / {
    proxy_pass http://localhost:10001;
  }
```

## Creating user and bot
1. Enter ```adduser admin``` to HA command promt
2. Enter ```addbot mybot 1``` (this bot should be located in the ```mybot``` folder, which is located in the folder specified in the config.json)