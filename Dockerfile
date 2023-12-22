FROM node:20
WORKDIR /usr/src/app
COPY . .
RUN npm install
RUN ./build-docs.sh
EXPOSE 1234
CMD ["node", "app.js"]

