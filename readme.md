This project is designed for gathering information from Hubspot API and pushing it to PostgreSQL database for Grafana to use.

## Prepare local environment

Install packages
    
    nvm install 12
    npm install

Prepare local variables file
    
    cat << EOF > ~/.config/hs2db_auth
    export _hs_apikey='<hubspot api key>'
    export _hs_url='<hubspot api url>'
    export _db_host='<host>'
    export _db_port='<port>'
    export _db_user='<user name>'
    export _db_password='<password>'
    export _db_database='<db name>'
    EOF

Then execute it  
    
    source ~/.config/hs2db_auth

## Run the script
    
    node app.js
