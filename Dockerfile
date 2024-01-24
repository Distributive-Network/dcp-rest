FROM node:20
WORKDIR /usr/src/app
COPY . .
RUN ./build-docs.sh
RUN npm install
EXPOSE 1234
CMD ["node", "app.js"]

