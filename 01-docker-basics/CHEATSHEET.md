# Docker basics — cheat sheet

## Concepts (1–2 lines each)
- Image vs container: so image is like default which we download such as postgres image which we download and based on that image we create containers which are different from each other by values
- Port mapping (-p HOST:CONTAINER): port mapping is to access docker containers from our browser like we can assign port 5432 to dockers 5432 postgres and we are able to connect localhost:5432 without it we dont have road to send trafic on it
- Environment variables (-e): these are for setting values when creating container such as connection configs for postgres
- Writable layer (why changes disappear after rm): when we create container it addes like layer after layer so starts with image which is read only and then we add our own, when we delete container these writable layers are deleted
- Volume: volume are storage which exists outside of container such as when we delete postgres most of the configs delete along with this but data are saved in volume so we need to manualy delete if we want to clear it


## Images
- docker pull ... it is pulling image from docker hub such as nginx image which we dont have on local we can download from hub
- docker images: all images we have downloaded
- docker rmi ... delete image

## Run a container
- docker run ...          (what -d, --name, -p, -e do)
-d is runing in background
--name is setting specific name instead of random
-p setting ports
-e env variables

## Look at containers
- docker ps / docker ps -a: firs tone is all runing second one all including stoped
- docker logs ...         (-f, --tail) this one shows logs for docker container, --tail 5 means last 5 and -f it keep online
- docker exec ...         (when -it, when no flags) -it means -t open terminal and -i keeps input open so my typing reaches the program. Use -it for things I type into (sh, psql, redis-cli); no flags for one-off commands (ls, cat, hostname)
- docker inspect ...   shows all data details of certain container in json format

## Lifecycle
- docker stop / start  plan stops and start container using name
- docker rm / rm -f  rm is removing stopped container if we want to make it fast we can add -f and it first stops and then removes it

## Cleanup
- docker volume ls / volume prune  volume is created outside of container which we want to keep even if container is deleted, prune is to delete. `volume ls` lists all volumes, `volume prune` deletes the unused ones
- docker system df it show usage of volumes containers and images 

## Errors I hit and what they meant
- invalid reference format → such as using @ isntead of : in image version
- address already in use → port is already in use, assign new port or stop old container with that port using
- name is already in use → names of container should be unique, delete or make new name
- Exited (1) on postgres → it means it returned with error: POSTGRES_PASSWORD missing → rm it and run again with -e POSTGRES_PASSWORD=...
- Exited (255) after reboot → not stopped cleanly (PC/Docker shut down) → just `docker start <name>`

## The 3 services I ran (one working command each)
- nginx: docker run -d --name nginx -p 8080:80 nginx:alpine   # HOST:CONTAINER, nginx listens on 80 inside
- postgres: docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=secret postgres:16
- redis: docker run -d --name redis -p 6379:6379 redis:latest
