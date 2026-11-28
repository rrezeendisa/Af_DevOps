proxy_pass http://java;
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host $http_host;
# A interface usa cookie de sessão. Nenhum Authorization do navegador chega ao Java.
proxy_set_header Authorization "";
proxy_set_header Cookie $http_cookie;
proxy_set_header X-XSRF-TOKEN $http_x_xsrf_token;
proxy_set_header X-Evolia-Contexto $http_x_evolia_contexto;
proxy_hide_header WWW-Authenticate;
proxy_hide_header X-Frame-Options;
proxy_hide_header X-Content-Type-Options;
proxy_redirect off;
proxy_intercept_errors off;
proxy_next_upstream off;
proxy_cache off;
proxy_connect_timeout 5s;
proxy_send_timeout 30s;
proxy_read_timeout 110s;
