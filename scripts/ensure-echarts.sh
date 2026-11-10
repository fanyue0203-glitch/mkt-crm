#!/bin/bash
# vite build 会清空 dist/，导致 echarts.min.js 丢失、看板图表全挂。
# build 后必须跑一次本脚本恢复。
set -e
cd "$(dirname "$0")/.."
if [ ! -f dist/echarts.min.js ]; then
  cp node_modules/echarts/dist/echarts.min.js dist/echarts.min.js
  echo "echarts.min.js restored"
else
  echo "echarts.min.js ok"
fi
