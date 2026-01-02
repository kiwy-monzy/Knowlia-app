echo DEBUG_START > debug.log
echo checking node >> debug.log
node -v >> debug.log 2>&1
echo checking npm >> debug.log
npm -v >> debug.log 2>&1
echo checking pnpm >> debug.log
pnpm -v >> debug.log 2>&1
echo DEBUG_END >> debug.log
