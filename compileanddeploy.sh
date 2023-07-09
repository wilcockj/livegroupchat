cd gobackend
killall chatbackend
go build
cp chatbackend ..
cd ..
BACKEND_MODE=production ./chatbackend
