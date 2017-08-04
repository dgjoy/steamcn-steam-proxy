FROM node:8.2.1

RUN sh -c 'printf "deb http://httpredir.debian.org/debian jessie-backports main" > /etc/apt/sources.list.d/jessie-backports.list'
RUN apt-get update && apt-get install -y shadowsocks-libev
RUN sed -i 's/ss-server/ss-local/g' /etc/init.d/shadowsocks-libev
RUN npm install -g pm2
RUN pm2 install typescript
RUN mkdir /app
WORKDIR /app

ENV SS_SERVER_IP 120.76.237.206
ENV SS_SERVER_PORT 10660
ENV SS_SERVER_PASSWORD DGJoy_shared
ENV SS_SERVER_METHOD chacha20-ietf

ADD package*.json ./
RUN npm install
ADD . ./

EXPOSE 27015
CMD echo "{\
    \"server\":\"$SS_SERVER_IP\",\
    \"server_port\":$SS_SERVER_PORT,\
    \"local_port\":1080,\
    \"password\":\"$SS_SERVER_PASSWORD\",\
    \"timeout\":60,\
    \"method\":\"$SS_SERVER_METHOD\"\
}" > /etc/shadowsocks-libev/config.json && service shadowsocks-libev start && pm2-docker index.ts
