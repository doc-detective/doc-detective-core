sudo apt-get update
# Install Firefox
sudo apt install snapd -y
sudo snap install firefox
which firefox
# Install Chrome
sudo apt-get install wget libxss1 libappindicator1 libindicator7 -y
sudo apt-get install -f
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install ./google-chrome*.deb -y
rm google-chrome-stable_current_amd64.deb
which google-chrome
# Install project dependencies
npm i