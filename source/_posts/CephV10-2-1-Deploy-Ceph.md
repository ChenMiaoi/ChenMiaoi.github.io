---
title: 'CephV10.2.1: Deploy Ceph'
mathjax: true
date: 2024-10-11 17:30:49
tags: [ceph, distribute system]
categories: [cephv10.2.1]
---

# CephV10.2.1: Deploy Ceph Cluster

## 编译 & 构建

- Ceph部署环境
  - OS: CentOS7.9
  - Version: v10.2.1
  - Method: Cmake Build

## Ceph模块分析和作用

![Ceph Architecture](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410111735229.png)

Ceph 的最底层基于 RADOS(Reliable, Autonomous, Distributed object store)，是一个可靠的、自组织的、可自动修复、自我管理的分布式对象存储系统。

- 块存储接口：通过 librbd(rados block device)库提供了块存储访问接口。可以为虚拟机提供虚拟磁盘，或通过内核映射为物理主机提供磁盘空间。 
- 对象存储接口： 
  - AWS S3 接口 API 
  - OpenStack Swift 接口 API 
- 文件系统接口： 
  - 标准 Posix 接口 
  - libcephfs 库接口

### Monitor(MON)节点

mon节点是Ceph集群的管理节点，负责维护集群的全局状态，包括存储节点（OSD）的健康状态、认证信息、CRUSH映射（存储位置算法），以及其他元数据。

通过 Paxos 分布式算法来确保集群状态的一致性。如果集群中的 mon 节点出现故障，只要多数（即至少一半以上的 mon 节点正常工作），集群就能继续正常运行

- **在启动Ceph集群时，mon节点应该最先启动，因为它负责维持整个集群的健康状态、存储管理、并为其他组件提供集群的配置信息**。 
- 当 mon 节点启动后，其他节点（如 OSD 和 MDS）才能与它们进行通信，进行注册并获取集群状态。

### Object Storage Daemon(OSD)节点

OSD 是Ceph中的对象存储守护进程，每个 OSD 代表一个物理或虚拟的存储设备。其负责存储数据、复制数据、恢复故障、重平衡数据，并提供给客户端读写访问的数据。OSD 节点通过 CRUSH 映射算法与 mon 交互，决定如何在集群中分布存储数据。集群中的所有 OSD 节点通过监控自身的状态，并定期向 mon 节点报告其状态（如在线、离线、正在恢复等）。

**OSD 节点在 mon 节点启动并成功运行后启动，因为它们需要从 mon 节点获取存储分布信息（CRUSH 映射）并注册自身**。OSD 节点启动后，会根据CRUSH映射将数据分布到集群中，并确保数据的冗余和复制。

### Metadata Server(MDS)节点

MDS 节点是Ceph文件系统（CephFS）的元数据服务器。它负责处理文件系统的元数据操作，比如目录结构、文件路径的解析、权限管理等。MDS 的作用是将CephFS中的元数据与数据操作分离。它只负责元数据的管理，而实际的文件数据则由 OSD 节点存储和处理。

**MDS 节点在 OSD 节点启动后启动，因为 MDS 需要依赖 OSD 提供底层的对象存储服务**。在 MDS 节点启动时，它会与 OSD 节点和 mon 节点通信，以了解集群的存储状态和元数据分布。

### Ceph File System(CephFS)

CephFS 是基于 Ceph 构建的分布式文件系统，允许客户端以文件和目录的方式访问数据，类似于传统的文件系统（如 NFS 或 ext4）。其将数据存储在 OSD 节点中，MDS 节点则处理文件系统的元数据操作，如目录树的管理、文件路径的解析等。

**CephFS 依赖于 mon、OSD 和 MDS 节点，因此 CephFS 需要在这些组件启动后才能正常工作**。在集群中配置和启用 CephFS 时，首先需要确保 OSD 和 mon 正常运行，然后 MDS 节点启动，最后是 CephFS 文件系统的启用和挂载。

### Rados GateWay(RGW)

RADOS Gateway（RGW）是Ceph的对象存储网关，它提供兼容Amazon S3和OpenStack Swift协议的RESTful API，用于对象存储。RGW允许用户通过HTTP协议直接与Ceph集群交互，适合需要对象存储的应用场景，比如云存储服务或大规模数据存储。它为Ceph提供了对象存储的前端，用户可以通过RGW将文件存储为对象，并通过唯一的对象键来检索数据，类似于云服务中的S3。

**RGW依赖于mon和OSD节点来存储和检索数据，因此它必须在mon和OSD节点启动后才能启动**。RGW 作为 Ceph 的一个**额外组件，不是必须的**，但在需要对象存储功能时，RGW 需要启动。启动时，*RGW会使用Ceph集群的认证系统（通常通过cephx身份验证机制），并与OSD节点交互以存储对象数据*。

![S3](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410111740748.png)

![Swift](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410111740702.png)

## vstart.sh脚本分析

在`vstart.sh`中提供了一些可选的参数，如下所示：

``` bash
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

了解完参数含义后，我们就开始逐段解析`vstart.sh`的部署过程。

### 前期准备

Ceph的部署需要在一个特定的文件夹中生成各类配置文件，包括mon、mds、osd等的配置目录，而`vstart.sh`会专门为`Cmake`编译后的部署做出处理，因此我们需要通过`run-cmake-check.sh`进行编译。

编译完成后，我们会在项目根目录下生成这样的目录树：

``` bash
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

其中，`bin`保存了我们所有编译出来的与`ceph`有关的二进制可执行程序，`lib`包含了`ceph`二进制可执行程序所需要的一切动静态库。

对于`vstart.sh`而言，如果环境变量中没有特殊配置，则会自动检索`CMakeCache.txt`来得到项目的根目录和`build`目录的路径。如果我们正确获取到这两个路径后，那么就会进行这样的配置：

``` bash
elif [ -n "$CEPH_ROOT" ]; then
        [ -z "$PYBIND" ] && PYBIND=$CEPH_ROOT/src/pybind
        [ -z "$CEPH_BIN" ] && CEPH_BIN=$CEPH_BUILD_DIR/bin
        [ -z "$CEPH_ADM" ] && CEPH_ADM=$CEPH_BIN/ceph
        [ -z "$INIT_CEPH" ] && INIT_CEPH=$CEPH_BIN/init-ceph
        [ -z "$CEPH_LIB" ] && CEPH_LIB=$CEPH_BUILD_DIR/lib
        [ -z "$OBJCLASS_PATH" ] && OBJCLASS_PATH=$CEPH_LIB
        [ -z "$EC_PATH" ] && EC_PATH=$CEPH_LIB
```

这样，Ceph就能够知道二进制可执行文件的位置以及所需要的动静态库位置。