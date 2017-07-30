FROM node:8.2.1

RUN sh -c 'printf "deb http://httpredir.debian.org/debian jessie-backports main" > /etc/apt/sources.list.d/jessie-backports.list'
RUN apt-get update && apt-get install -y shadowsocks-libev
RUN sed -i 's/ss-server/ss-local/g' /etc/init.d/shadowsocks-libev
# hk2.relay.cn2.moe
RUN echo '{\
    "server":"120.76.237.206",\
    "server_port":10660,\
    "local_port":1080,\
    "password":"DGJoy_shared",\
    "timeout":60,\
    "method":"chacha20-ietf"\
}' > /etc/shadowsocks-libev/config.json
RUN npm install -g pm2
RUN pm2 install typescript
RUN mkdir /app
WORKDIR /app

ADD package*.json ./
RUN npm install
ADD . ./

EXPOSE 27015
CMD service shadowsocks-libev start && pm2-docker index.ts
