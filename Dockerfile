FROM nginx:1.27-alpine

COPY webui/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
