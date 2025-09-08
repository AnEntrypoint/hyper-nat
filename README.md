# hyper-nat

tl;dr: play lan games with your friends or use any other network oriented tool over the internet using peer to peer magic

This program can securely negotiate and tunnel sets of UDP and TCP connections between servers and clients, allowing them to carry out low latency two directional communications without any external routing using back-punching or hole-punching mechanisms with heuristic optimizations to cater for 99% of modern internet connections.

It does this by establishing a peer to peer connection directly to the other computer using an amazing technology called hyperswarm.

https://github.com/hyperswarm

Run server ports on one computer, and run client ports on a group of clients, and you can connect a group of computers to your server.

[https://www.youtube.com/watch?v=iFyCTpgiTUE](https://www.youtube.com/watch?v=XEslzWotf_Q)

If you do not wish to download node.js, you can get a prebuild version for windows under releaases.

You will be receive a public public key to share with your friends, that goes into their options.json, make sure to configure your servers options.json to have a unique secretkey sot hat the publickey can be unique

# WINDOWS TROUBLESHOOTING
the terminal in windows pauses when you click on it, it goes into a text-selection mode, just click on the window and press enter if any area is selected to unstick it.

Configure a options.json file

# server config for a udp and a tcp port
# mode
selects client or server
# proto 
selects tcp or udp
# port 
specifies the port number to share
# host 
specifies where the game/app server is running
# secret 
is your unique secret code, dont use the same
  one in two places, because its also your identifier
  on the peer to peer network
```
{
    "schema": [
        {
            "mode": "server",
            "proto": "udp",
            "port": "7913",
            "host": "127.0.0.1",
            "secret":"thisisaseretsecret"
        },
        {
            "mode": "server",
            "proto": "tcp",
            "port": "7915",
            "host": "127.0.0.1",
            "secret":"thisisaseretsecret"
        }
    ]
}
```
# client config for the same ports
# mode 
selects client or server
# proto 
selects tcp or udp
# port 
specifies the port number
# serverport 
specifies the port number on the server
# publicKey
is provided to you by the person who starts
the server, it will be printed on their terminal
when their app starts and is based on their secret
```
{
  "schema": [
    {
        "mode": "client",
        "proto": "udp",
        "port": "7913",
        "serverport": "7913",
        "publicKey":"8KdZA6WUUjkpSJSFoUHKfuj2hTygNkbLFnREPwn8u89r"
    },
    {
        "mode": "client",
        "proto": "tcp",
        "port": "7915",
        "serverport": "7915",
        "publicKey":"8KdZA6WUUjkpSJSFoUHKfuj2hTygNkbLFnREPwn8u89r"
    }
  ]
}
```

# building
To build the exe yourself, use a nexe compatible version of node, then run nexe in the path, remember to copy the static builds for sodium and udx

A big thank you to Mathias Buus aka mafintosh for all the help and guidance with my n00b questions and for adding the neccesary features as this project was developed
