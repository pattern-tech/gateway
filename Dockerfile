# Set the base image
FROM node:20.11

# Use SSH during the build process
RUN apt-get update && apt-get install -y openssh-client && apt-get clean

# Ensures the known hosts include GitHub
RUN mkdir -p ~/.ssh && ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

# Copy SSH keys from the build context
ADD ./docker_ssh/ /root/.ssh/

RUN mkdir /root/.certs

# ADD ./certs/ /root/.certs/

# Set permissions for SSH keys
RUN chmod 600 /root/.ssh/id_ed25519 && chmod 644 /root/.ssh/id_ed25519.pub

# Add GitHub to known hosts
RUN ssh-keyscan github.com >> /root/.ssh/known_hosts

# WORKDIR /usr/src/app/
WORKDIR /home/gateway

# Dockerfile author / maintainer
LABEL maintainer="Michael Feng <mike@hummingbot.org>"

# Build arguments
LABEL branch=${BRANCH}
LABEL commit=${COMMIT}
LABEL date=${BUILD_DATE}

# Set ENV variables
ENV COMMIT_BRANCH=${BRANCH}
ENV COMMIT_SHA=${COMMIT}
ENV BUILD_DATE=${DATE}
ENV INSTALLATION_TYPE=docker

# Create mount points
RUN mkdir -p /home/gateway/conf /home/gateway/logs /home/gateway/db /home/gateway/certs

# Copy files and Install dependencies
COPY package.json ./
COPY yarn.lock ./
RUN yarn install



# compile
COPY . .

RUN rm -rf /root/.ssh ./certs ./docker_ssh 

RUN yarn build

# Expose port 15888 - note that docs port is 8080
EXPOSE 15888

# Set the default command to run when starting the container
CMD yarn run start