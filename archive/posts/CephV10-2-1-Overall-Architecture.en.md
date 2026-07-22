---
slug: CephV10-2-1-Overall-Architecture.en
title: 'CephV10.2.1: Overall Architecture'
published: 2024-10-12
tags:
  - ceph
  - distribute system
category: cephv10.2.1
series: cephv10-2-1
lang: "en"
---
This section introduces the overall system architecture of Ceph.

## Ceph's Design Goals

***The design goal of Ceph is to build a large-scale, highly available, highly scalable, and high-performance distributed storage system***.

High availability refers to the system's ability to keep providing normal service after one of its components fails. It is generally achieved through redundancy of device components and data. Ceph provides data redundancy through multiple data replicas and erasure coding.

High scalability means the system can flexibly handle cluster scaling. It generally refers to two aspects: on the one hand, the cluster's capacity can scale—storage nodes and storage devices can be added or removed at will; on the other hand, the system's performance increases linearly as the cluster grows.

## Ceph Basic Architecture

![Ceph基本架构](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131738213.png)

The overall architecture of Ceph consists of three layers:

- The bottommost and most core part is the RADOS object storage system. Based on RADOS ($Reliable, Autonomous, Distributed\ object\ store$), it is a reliable, self-organizing, self-healing, and self-managing distributed object storage system. Internally it includes the `ceph-osd` background service and the `ceph-mon` monitor
- The `librados` layer is used to access the RADOS object storage system locally or remotely over the network
- The Ceph storage interface implementation layer
  - The block storage interface, which provides block storage access through `librbd`. It can provide virtual disks for virtual machines, or provide disk space for physical hosts through kernel mapping.
  - The object storage interface, which currently provides two types of APIs:
    - AWS S3 API
    - OpenStack Swift API
  - The file storage interface, which provides two types of interfaces; file system metadata is accessed through the `MDS`, while data is accessed directly through `librados`
    - Standard POSIX interface  
    - `libcephfs`  

## Ceph Client Interfaces

### RBD

RBD ($Rados\ Block\ Device$) provides block storage to applications through `librbd`, mainly providing virtual disks for virtual machines on cloud platforms.

Currently RBD provides two interfaces. One is implemented directly in user space and is used by KVM virtual machines through the `QEMU Driver`. The other implements a kernel module in the operating system's kernel space; through this module, block devices can be mapped to physical hosts and accessed directly by them.

**Block storage requires both good random I/O and good sequential I/O, and has relatively strict latency requirements**.

### CephFS

CephFS provides file storage by adding an $MDS(Metadata\ Server)$ on top of $RADOS$. It provides `libcephfs` and the standard POSIX file interface. **CephFS provides file systems or file directories through the NFS or CIFS protocols**.

### RadosGW

$RadosGW$ provides object storage interfaces compatible with the Amazon S3 interface and the OpenStack Swift interface, based on `librados`. It can simply be understood as fulfilling basic file upload and download needs:

- **Provides a $RESTful\ Web\ API$**
- **Uses a flat data organization**

#### RESTful Storage Interface

It simply provides interfaces such as `GET`, `PUT`, and `DEL`, corresponding to file upload, download, deletion, and query operations.

#### Flat Data Organization

![Amazon S3](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131752728.png)

![OpenStack Swift](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131752185.png)

## RADOS

$RADOS$ is the foundation of the Ceph storage system; it implements the core functions of a storage system:

- The Monitor module provides global configuration and system information for the entire storage cluster
- The CRUSH algorithm implements the object addressing process
- Handling object reads/writes and other data functions
- Providing data balancing
- Completing the process of reaching data consistency within a PG through Peering
- Providing data self-recovery
- Providing cloning and snapshot functions
- Implementing tiered object storage
- Implementing the data consistency check tool Scrub

### Monitor

$Monitor$ is an independently deployed daemon process. It ensures its own high availability by forming a Monitor cluster. The Monitor cluster achieves consistency of its own data through the Paxos algorithm. It provides global configuration information for the entire storage system, such as node information.

The $Cluster\ Map$ stores the system's global information, mainly including:

- Monitor Map
  - The cluster's fsid
  - The addresses and ports of all Monitors
  - current epoch
- OSD Map
  - The list of all OSDs, their states, and so on
- MDS Map
  - The list and states of all MDSs

The $Cluster\ Map$ is stored directly in the $Monitor$'s memory, but we can inspect it through the $mon/store.db/*.sst$ files:

```bash
ceph-kvstore-tool rocksdb */mon.a/store.db/*.sst list
```

Note that: **these files contain a large amount of content and are not suitable for direct viewing**.

The $Monitor\ Map$, $OSD\ Map$, and $MDS\ Map$ are all stored in the `rocksdb` database, so they cannot be viewed directly either; we can view them through Ceph commands:

```bash
ceph mon getmap -o ./monmap.bin
monmaptool --print ./monmap.bin

monmaptool: monmap file ./monmap.bin
epoch 1
fsid 5bbbc20d-a725-4e68-a426-4c9210a4062e
last_changed 2024-10-13 18:02:39.282195
created 2024-10-13 18:02:39.282195
0: <mon_ip>:6789/0 mon.a
```

Since I only started one `MON` node at startup, only one `MON` node's information is output here. The `fsid` ($File\ System\ ID$) is **a unique identifier used to identify and distinguish Ceph clusters. Each Ceph cluster generates an `fsid` during initialization and stores it in the cluster's configuration files and metadata**. The `fsid` is a 128-bit UUID expressed in hexadecimal format.

Information about the remaining nodes can be viewed with the following commands:

```bash
# 方式一
ceph mon/osd dump
ceph mds stat

# 方式二
ceph mon/osd/mds getmap
*maptool --print /path/to/*map.bin #V10.2.1版本未提供mdsmaptool
```

### Object Storage

The objects here all refer to $RADOS$ objects and need to be distinguished from the S3 or Swift objects of $RadosGW$. **An object is the basic unit of data storage, with a default size of $4MB$**, as shown in the figure below.

![对象示意图](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131823505.png)

An object consists of three parts:

- Identifier (ID), which uniquely identifies an object
- Data, which corresponds to a file in the local file system; an object's data is stored in the file
- Metadata, stored in $Key-Value$ form; $RADOS$ uses local KV storage systems such as $LevelDB$ to store object metadata

### pool & PG

A $pool$ is an abstract storage pool that specifies the type of data redundancy and the corresponding replica distribution policy. Two types of $pool$ are currently implemented:

- $Replicated$
- $Erasure\ Code$

A $pool$ consists of multiple $PG$s. $PG(Placement\ Group)$, as the name suggests, can be understood as a placement policy group. **It is a collection of objects, all of which share the same placement policy: *the replicas of the objects are all distributed over the same list of $OSD$s; an object can only belong to one PG; a PG corresponds to the list of OSDs on which it is placed; and multiple PGs can be distributed on a single OSD***.

![PG概念示意图](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131859238.png)

- $PG1$ and $PG2$ both belong to the same $pool$, so they are both of the replicated type with two replicas
- $PG1$ and $PG2$ both contain many objects; the primary and secondary replicas of all objects in $PG1$ are distributed on $OSD1$ and $OSD2$, and the primary and secondary replicas of all objects in $PG2$ are distributed on $OSD2$ and $OSD3$
- An object can only belong to one $PG$; a $PG$ contains multiple objects
- The replicas of a $PG$ are distributed across the corresponding $OSD$ list, and multiple $PG$s can be distributed on a single $OSD$

### Object Addressing Process

The object addressing process refers to **looking up the location information of an object's distribution in the cluster**. The process is divided into two steps:

- Mapping from object to $PG$. This process is a static $Hash$ mapping (after $pg\ split$ is introduced, it actually becomes a dynamic $Hash$ mapping): compute a $hash$ value from the $object_id$, take the hash modulo $pg_num$ (the total number of $PG$s in that $pool$), and you get the $id$ of the $PG$ where the object resides:

```python
pg_id = hash(object_id) % pg_num
```

- Mapping from $PG$ to the $OSD$ list. This refers to how the replicas of objects in a $PG$ are distributed across $OSD$s, implemented using Ceph's innovative $CRUSH$ algorithm:

![对象寻址过程](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131907133.png)

#### Data Read/Write Process

![读写过程](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131908931.png)

1. The Client sends a write request to the primary $OSD$ of the $PG$
2. After receiving the write request, the primary $OSD$ simultaneously sends replica-write requests to the other two $OSD$s, and writes to its own local storage at the same time
3. After the primary $OSD$ receives $ACK$ replies indicating successful writes from the two secondary $OSD$s and confirms its own write succeeded, it returns a write-success $ACK$ reply to the client

**In a write operation, the primary $OSD$ must wait for all secondary $OSD$s to return correct replies before it can report write success to the client**.

#### Data Balancing

**When a new OSD storage device is added to the cluster, data migration occurs across the entire cluster so that the data distribution becomes balanced**. *The basic unit of Ceph data migration is the* $PG$, meaning data migration moves all objects in a $PG$ as a whole.

The migration trigger flow is: **a newly added OSD changes the system's $CRUSH\ MAP$, which causes the second step of the object addressing process—the mapping from $PG$ to the $OSD$ list—to change, thereby triggering data migration**.

![数据迁移](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131917345.png)

#### Peering

**When an OSD starts, or when an OSD fails, the primary $PG$ on that OSD initiates a Peering process**. *Ceph's Peering process refers to the process in which all replicas within a $PG$ reach data consistency through the $PG$ log*.

After Peering completes, the $PG$ can provide read/write services externally. At this point, some objects in the $PG$ may be in a data-inconsistent state; they are marked and need to be recovered. The system prioritizes recovering these objects before continuing with write operations.

#### Recovery & Backfill

#### Erasure Coding

#### Snapshot and Clone

A $SnapShot$ **is a *full read-only image* of a storage device at a certain point in time**. A $Clone$ **is a *full writable image* at a certain point in time**.

The $RADOS$ object storage system itself supports a $Copy-on-Write$ snapshot mechanism. Based on this mechanism, Ceph can implement two types of $SnapShot$:

- $pool$-level: performing a unified snapshot operation on all objects in an entire $pool$
- User-defined snapshots; the $RBD$ snapshot implementation belongs to this level

#### Cache Tier

$RADOS$ implements a $pool$-based automatic tiered storage mechanism. The first tier can be configured as a $cache\ pool$, **which consists of high-speed storage devices**; the second tier is the $data\ pool$, **which uses large-capacity, low-speed storage devices and can use EC mode to reduce storage space consumption**.

Through $Cache\ Tier$, **the performance of critical or hot data can be improved while reducing storage overhead**:

![Cache Tier](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410131927609.png)

- The Ceph Client is transparent to the Cache tier
- The Objecter is responsible for deciding whether a request is sent to the Cache Tier or to the Storage Tier
- The Cache Tier is the high-speed I/O tier, holding hot data, also called active data
- The Storage Tier is the slow tier, holding inactive data
- Between the Cache Tier and the Storage Tier, data migrates automatically based on activity level

#### Scrub

$Scrub$ **is used by the system to check data consistency: it periodically scans in the background, comparing the metadata and data of each replica of an object in a $PG$ on the other $OSD$s to check whether they are consistent**.

According to the scanned content, it is divided into two types:

- Only comparing the metadata of each replica of an object: low cost, high efficiency, and minimal impact on the system
- $deep\ scrub$: requires comparing not only the metadata but also the data
