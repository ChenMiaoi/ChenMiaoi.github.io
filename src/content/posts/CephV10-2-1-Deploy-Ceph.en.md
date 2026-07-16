---
slug: CephV10-2-1-Deploy-Ceph.en
title: 'CephV10.2.1: Deploy Ceph'
published: 2024-10-11
tags:
  - ceph
  - distribute system
category: cephv10.2.1
series: cephv10-2-1
lang: "en"
---
## Compile & Build

- Ceph deployment environment
  - OS: CentOS7.9
  - Version: v10.2.1
  - Method: Cmake Build

## Analysis and Roles of Ceph Modules

![Ceph Architecture](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410111735229.png)

At its lowest layer, Ceph is built on RADOS (Reliable, Autonomous, Distributed Object Store), a reliable, self-organizing, self-healing, and self-managing distributed object storage system.

- Block storage interface: provides block storage access through the librbd (rados block device) library. It can provide virtual disks for virtual machines, or be mapped by the kernel to provide disk space for physical hosts.
- Object storage interface:
  - AWS S3 interface API
  - OpenStack Swift interface API
- File system interface:
  - Standard Posix interface
  - libcephfs library interface

### Monitor (MON) Node

A mon node is the management node of a Ceph cluster, responsible for maintaining the global state of the cluster, including the health status of storage nodes (OSDs), authentication information, the CRUSH map (the storage placement algorithm), and other metadata.

It uses the Paxos distributed algorithm to ensure the consistency of the cluster state. If a mon node in the cluster fails, as long as a majority (i.e., more than half of the mon nodes are working properly), the cluster can continue to operate normally.

- **When starting a Ceph cluster, the mon nodes should be started first, because they are responsible for maintaining the health status of the entire cluster, managing storage, and providing cluster configuration information to other components**.
- Only after the mon nodes have started can other nodes (such as OSDs and MDSs) communicate with them, register themselves, and obtain the cluster state.

### Object Storage Daemon (OSD) Node

An OSD is the object storage daemon in Ceph; each OSD represents a physical or virtual storage device. It is responsible for storing data, replicating data, recovering from failures, rebalancing data, and serving read/write access to clients. OSD nodes interact with the mon through the CRUSH mapping algorithm to decide how to distribute data across the cluster. All OSD nodes in the cluster monitor their own state and periodically report their status (such as online, offline, recovering, etc.) to the mon nodes.

**OSD nodes are started after the mon nodes have started and are running successfully, because they need to obtain the data distribution information (CRUSH map) from the mon nodes and register themselves**. After an OSD node starts, it distributes data across the cluster according to the CRUSH map and ensures data redundancy and replication.

### Metadata Server (MDS) Node

An MDS node is the metadata server of the Ceph File System (CephFS). It is responsible for handling file system metadata operations, such as directory structures, file path resolution, permission management, and so on. The role of the MDS is to separate metadata operations from data operations in CephFS. It only manages metadata, while the actual file data is stored and handled by the OSD nodes.

**MDS nodes are started after the OSD nodes, because the MDS depends on the underlying object storage service provided by the OSDs**. When an MDS node starts, it communicates with the OSD nodes and mon nodes to learn about the cluster's storage state and metadata distribution.

### Ceph File System (CephFS)

CephFS is a distributed file system built on top of Ceph, allowing clients to access data in the form of files and directories, similar to traditional file systems (such as NFS or ext4). It stores data in OSD nodes, while MDS nodes handle file system metadata operations, such as managing the directory tree and resolving file paths.

**CephFS depends on mon, OSD, and MDS nodes, so CephFS can only work properly after these components have started**. When configuring and enabling CephFS in a cluster, you first need to ensure that the OSDs and mons are running normally, then start the MDS nodes, and finally enable and mount the CephFS file system.

### Rados GateWay (RGW)

The RADOS Gateway (RGW) is Ceph's object storage gateway. It provides a RESTful API compatible with the Amazon S3 and OpenStack Swift protocols for object storage. RGW allows users to interact directly with the Ceph cluster over the HTTP protocol, making it suitable for application scenarios that require object storage, such as cloud storage services or large-scale data storage. It provides an object storage front end for Ceph: users can store files as objects through RGW and retrieve data via unique object keys, similar to S3 in cloud services.

**RGW depends on mon and OSD nodes to store and retrieve data, so it must be started after the mon and OSD nodes have started**. As an **optional component of Ceph, RGW is not required**, but when object storage functionality is needed, RGW must be started. At startup, *RGW uses the Ceph cluster's authentication system (usually through the cephx authentication mechanism) and interacts with the OSD nodes to store object data*.

![S3](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410111740748.png)

![Swift](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410111740702.png)

## Analysis of the vstart.sh Script

`vstart.sh` provides a number of optional parameters, as shown below:

```bash
-d, --debug
-s, --standby_mds
-l, --localhost
-i <ip>
-r
-n, --new
--valgrind[_{osd,mds,mon}]
--nodaemon
--smallmds
-m ip:port
-k
-x/X
--hitset <pool> <hit_set_type>
-e
-o config
--mon_num
--osd_num
--mds_num
--rgw_port
--bluestore
--memstore
--cache <pool>
--short
```

After understanding what these parameters mean, we can start analyzing the deployment process of `vstart.sh` section by section.

### Preparation

Ceph deployment requires generating various configuration files in a specific directory, including the configuration directories for mon, mds, osd, and so on. Since `vstart.sh` handles deployment specifically for builds made with `Cmake`, we need to compile via `run-cmake-check.sh`.

After the compilation is complete, the following directory tree will be generated under the project root directory:

```bash
ceph
├── ...
└── build
          ├── bin
          ├── CMakeCache.txt
          ├── CMakeFiles
          ├── include
          ├── lib
          ├── Makefile
          └── src
```

Here, `bin` holds all the compiled `ceph`-related binary executables, and `lib` contains all the dynamic and static libraries required by the `ceph` binary executables.

For `vstart.sh`, if there is no special configuration in the environment variables, it will automatically look up `CMakeCache.txt` to obtain the paths of the project root directory and the `build` directory. Once we have correctly obtained these two paths, the following configuration will be applied:

```bash
elif [ -n "$CEPH_ROOT" ]; then
        [ -z "$PYBIND" ] && PYBIND=$CEPH_ROOT/src/pybind
        [ -z "$CEPH_BIN" ] && CEPH_BIN=$CEPH_BUILD_DIR/bin
        [ -z "$CEPH_ADM" ] && CEPH_ADM=$CEPH_BIN/ceph
        [ -z "$INIT_CEPH" ] && INIT_CEPH=$CEPH_BIN/init-ceph
        [ -z "$CEPH_LIB" ] && CEPH_LIB=$CEPH_BUILD_DIR/lib
        [ -z "$OBJCLASS_PATH" ] && OBJCLASS_PATH=$CEPH_LIB
        [ -z "$EC_PATH" ] && EC_PATH=$CEPH_LIB
```

In this way, Ceph knows where the binary executables are located, as well as the locations of the required dynamic and static libraries.
