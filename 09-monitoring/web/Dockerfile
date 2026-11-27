# Frontend image: the HTML and its nginx config are baked IN, so a new commit = a new image tag.
# (Before, they were mounted from the server's disk → pulling images never changed the page.)
FROM nginx:alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/
