# Use an official Node 18 runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install any needed packages
RUN npm install

# Bundle app source
COPY . .

# Your apps bind to a port, expose it
EXPOSE 3000

# Start the application
CMD ["node"]

