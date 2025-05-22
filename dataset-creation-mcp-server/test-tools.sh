#!/bin/bash

echo "Testing tools/list..."
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node build/index.js 2>/dev/null

echo -e "\nTesting html_to_markdown tool..."
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"html_to_markdown","arguments":{"html":"<h1>Test</h1><p>Hello world</p>","clean":true}}}' | node build/index.js 2>/dev/null