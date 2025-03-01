#!/bin/bash

# Update package list and install distutils
apt-get update
apt-get install -y python3-distutils

# Install Node.js dependencies
npm install