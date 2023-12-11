# Use an official Node 18 runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the entire current directory contents into the container
COPY . .

# Install any needed packages specified in package.json
RUN npm install

# Note: this won't work for typical operations
#COPY /home/will/git/dcp-client/dist/dcp-client-bundle.js /usr/src/app/file.js

# Your apps bind to a port, expose it
EXPOSE 1234

# Start the application
CMD ["node", "app.js"]

