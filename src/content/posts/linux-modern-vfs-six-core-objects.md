---
title: VFS 的六大核心对象
published: 2026-08-26T15:10:00+08:00
description: 从路径、挂载和文件描述符出发，理解 Linux VFS 中 file、path、mount、dentry、inode 与 super_block 六个关键结构的职责和关系。
image: ''
tags:
  - Linux
  - VFS
  - 文件系统
  - 内核源码
category: linux
series: linux-modern-vfs
seriesOrder: 1
lang: zh_CN
draft: false
translations:
  en:
    title: "The Six Core Objects of VFS"
    description: "Starting with paths, mounts and file descriptors, explore the roles and relationships of file, path, mount, dentry, inode and super_block in Linux VFS."
    tags: ["Linux","VFS","File systems","Kernel source"]
  zh_TW:
    title: "VFS 的六大核心物件"
    description: "從路徑、掛載和檔案描述符出發，理解 Linux VFS 中 file、path、mount、dentry、inode 與 super_block 六個關鍵結構的職責和關係。"
    tags: ["Linux","VFS","檔案系統","核心原始碼"]
  ja:
    title: "VFS の六つの主要オブジェクト"
    description: "パス、マウント、ファイルディスクリプタを手掛かりに、Linux VFS の file、path、mount、dentry、inode、super_block の役割と関係を解説します。"
    tags: ["Linux","VFS","ファイルシステム","カーネルソース"]
---

VFS（Virtual File System）是 Linux 中最重要的子系统之一。

它于 XXX 年由谁提出并构建，随后在 Linux 中不断演进与更新。目前 Linux 已经迭代到了 7.x 版本，但市面上的书籍大多还停留在讲解 2.x、3.x、4.x 的 VFS。

相较于 2.x、3.x 和 4.x 时代，Linux 在 VFS 上已经做了大量更新。因此，我们这里会从最新版本的 Linux Mainline （45c13f3f9e3b， Linux 7.3）出发，深入讲解现代 VFS 的设计理念以及源码解读。

虚拟文件系统（Virtual File System，也称为 Virtual Filesystem Switch，虚拟文件系统切换层）是内核中的一个软件层，为用户空间程序提供文件系统接口。同时，它也为内核内部提供了一种抽象，使不同的文件系统实现能够共存 。

VFS 的系统调用，例如 `open(2)`、`stat(2)`、`read(2)`、`write(2)`、`chmod(2)` 等，都是在进程上下文中调用的。

因此，我们就会从一个系统调用的视角来理解 VFS 的核心对象，如下图所示。

```c
int fd = open("/tmp/a.txt", O_RDONLY);

进程
  │
  └── fd
        │
        ▼
      struct file
        │
        ├── f_path（struct path）
        │       ├── dentry("a.txt") ─── inode
        │       └── mnt（vfsmount）
        │
        └── f_op ─── file_operations（支撑结构）

inode
  └── i_sb ─── super_block
                    │
                    └── s_type ─── file_system_type（相关结构）
```

其实从严格意义上来说，它是要从进程内部调用的。

一个进程通过文件描述符，最终找到某个文件的打开状态、路径、目录项（dentry）、inode 以及所属文件系统。

`file` 通过其 `f_path` 成员保存当前打开文件的路径信息；`f_path` 是一个 `struct path`，由挂载实例和目录项共同构成。

严格来说，文件描述符并不是直接指向 struct file，中间还有这么一个过程。

```c
task_struct
  └── files_struct
        └── fdtable
              └── fd[3] → struct file
```

但是目前我们主要分析的是 VFS 的核心对象，因此在这里可以暂时先忽略其他联系起来的部分，我们只关注 VFS。

其实从上面的图中可以看到，本文选择 6 个关键结构来理解 VFS：`file`、`path`、`mount`、`dentry`、`inode` 和 `super_block`。当然，其他书籍或内核分析也可能采用不同的分类方式；这里的六个结构只代表本文的组织方式。

这里的 `file_operations` 和 `file_system_type` 是理解 VFS 所需的支撑结构，但不计入本文选择的六个核心结构：前者提供文件操作的函数表，后者描述并注册一种文件系统类型。

## 一次 open() 如何找到文件？

对于一个真正的文件系统，或者使用 Linux 系统的用户来说，打开文件是我们经常遇到的操作。

对于想要学习 VFS 的读者或用户而言，我们需要追踪当使用 open 函数打开一个文件时，其内部原理究竟是什么样的。因此，我们会从 open 函数（或者说这个系统调用）开始，学习如何结合这 6 个核心对象来进行理解。

当然，我们肯定要先介绍一点关于这 6 个核心对象的一些基本原理，因此这里会引用 VFS 的 Linux Documentation 的官方描述:

- File Object

    打开文件还需要执行另一个操作：分配一个 `file` 结构体。该结构体是文件描述符在内核中的实现。

    新分配的 `file` 结构体会被初始化，主要包括：

    - 指向 `dentry` 的指针；
    - 一组文件操作成员函数。

    ```c
    struct file {
      struct path;
      struct file_operations;
    }

    struct path {
      struct vfsmount;
      struct dentry;
    }
    ```

    这些文件操作函数取自 inode 中保存的数据。随后，VFS 会调用 `open()` 文件操作方法，使具体的文件系统实现执行自己的处理逻辑。可以看到，这又是一次由 VFS 完成的“切换”：根据具体文件系统调用相应的实现。

    接下来，`file` 结构体会被放入当前进程的文件描述符表中。

    读取、写入和关闭文件，以及其他各种 VFS 操作，都是先通过用户空间的文件描述符找到相应的 `file` 结构体，再调用其中对应的操作方法来完成。

    只要文件处于打开状态，就会持续持有并使用对应的 `dentry`；这也意味着相应的 VFS inode 会继续处于使用状态。

- Directory Entry Cache

    VFS 实现了 `open(2)`、`stat(2)`、`chmod(2)` 等系统调用。这些系统调用接收的路径名参数，会被 VFS 用来搜索目录项缓存（directory entry cache），也称为 dentry cache 或 dcache。

    目录项缓存提供了一种非常快速的查找机制，可将路径名（文件名）映射到对应的 dentry。dentry 常驻于 RAM 中，且不会被保存到磁盘；其存在的目的只是为了提升性能。

    目录项缓存旨在构建整个文件空间的一个视图。由于多数计算机无法同时将所有 dentry 都放入 RAM，缓存中通常只包含其中一部分。

    为将路径名解析为对应的 dentry，VFS 可能需要沿路径逐级创建 dentry，并进一步加载 inode；这一过程最终依赖于 inode 的查找来完成。

- Inode Object

    单个 dentry 通常包含一个指向 inode 的指针。inode 表示文件系统中的对象，例如普通文件、目录、FIFO 等。

    inode 既可能位于磁盘上，也可能位于内存中：

    - 对于基于块设备的文件系统，inode 通常保存在磁盘上；
    - 对于伪文件系统，inode 通常只存在于内存中。

    当需要访问磁盘上的 inode 时，内核会将其复制到内存中；如果 inode 发生变化，相关修改也会写回磁盘。

    同一个 inode 可能被多个 dentry 指向，例如硬链接就是这种情况。

    为查找 inode，VFS 需要调用父目录 inode 的 `lookup()` 方法；该方法由 inode 所属的具体文件系统实现提供。

    当 VFS 获得所需的 dentry（也就获得了对应的 inode）后，就可以执行诸如 `open(2)` 打开文件，或 `stat(2)` 查看 inode 数据等操作。

    `stat(2)` 的流程相对简单：VFS 获得 dentry 后，读取其中关联的 inode 数据，并将其中一部分信息返回给用户空间。


本次追踪的流程通过 Linux 7.3 （45c13f3f9e3b）内核版本以及 ramfs 进行，ramfs 是 Linux 中一种非常简单的内存文件系统，文件、目录和 inode 都保存在 RAM 中，不依赖磁盘，因此系统重启或断电后数据会丢失。它实现简单、代码量少，因此用来学习 VFS 中的 `file_system_type`、`super_block`、`inode`、`dentry` 以及文件和目录操作流程是最为合适的。

假设我们已经有了一个文件 `a.txt` ，其中内容为：

```bash
$ cat a.txt
hello world
```

当我们执行 `cat a.txt` 时，程序需要先通过 `openat(2)` 找到并打开这个文件。这里不展开 RISC-V 的异常入口、libc 封装以及内核中的所有辅助函数，只关注这次调用如何连接六个关键结构。

```c
openat()
  → do_sys_openat2()
  → do_file_open()
  → path_openat()
  → do_open()
  → vfs_open()
  → 返回文件描述符
```

这条调用链只保留和文件打开过程直接相关的几个阶段。不同内核版本的函数名称和内部组织可能发生变化，但它们承担的基本职责相近。

## open 和 openat 的区别

`open` 和 `openat` 都用于打开文件，区别在于相对路径的解析起点不同：`open` 默认使用当前工作目录，`openat` 则可以使用指定目录文件描述符作为基准目录。

因此，下面两种写法在以当前工作目录为基准时具有相近的效果。

```c
open("a.txt", O_RDONLY);
-> openat(AT_FDCWD, "a.txt", O_RDONLY);
```

现代用户态程序常常最终使用 `openat`，所以本文以它作为分析入口。这里的重点不是区分系统调用封装，而是观察路径如何变成一个内核中的 `struct file`。

## 从路径到 file

一次 `openat()` 的关键过程可以从 `path_openat()` 看出来。下面保留与 VFS 对象关系直接相关的代码，省略错误处理和资源释放的细节：

```c
static struct file *path_openat(struct nameidata *nd,
                                const struct open_flags *op,
                                unsigned flags)
{
    struct file *file;
    int error;

    file = alloc_empty_file(op->open_flag, current_cred());
    if (IS_ERR(file))
        return file;

    if (unlikely(file->f_flags & __O_TMPFILE)) {
        error = do_tmpfile(nd, flags, op, file);
    } else if (unlikely(file->f_flags & O_PATH)) {
        error = do_o_path(nd, flags, file);
    } else {
        const char *s = path_init(nd, flags);

        while (!(error = link_path_walk(s, nd)) &&
               (s = open_last_lookups(nd, file, op)) != NULL)
            ;

        if (!error)
            error = do_open(nd, file, op);
        terminate_walk(nd);
    }

    if (likely(!error) && (file->f_mode & FMODE_OPENED))
        return file;

    fput_close(file);
    return ERR_PTR(error);
}
```

这段函数首先调用 `alloc_empty_file()` 创建一个空的 `struct file`。因此，`file` 并不是在路径解析完成之后才出现，而是在 `path_openat()` 开始时就已经准备好，后续解析结果会逐步填充到这个对象中。

接下来，函数根据打开标志选择不同分支：

- `do_tmpfile()` 处理匿名临时文件；
- `do_o_path()` 处理只获取路径对象的 `O_PATH`；
- 普通文件打开则进入路径解析流程。

### 路径解析：暂时只保留对象关系

普通打开流程会依次经过 `path_init()`、`link_path_walk()` 和 `open_last_lookups()`。它们共同负责把路径字符串转换为最终的 `struct path`：

```text
路径字符串
  → path_init()           确定起始 path
  → link_path_walk()      遍历路径组件
  → open_last_lookups()   处理最后一个组件
  → 最终 path = mnt + dentry
```

`path_init()` 会从根目录、当前工作目录或 `dirfd` 对应的 `f_path` 设置起点；后续路径遍历会不断更新 `nd->path`。普通路径组件主要改变 `dentry`，遇到挂载点时还会切换 `mnt`，并进入新挂载实例的根目录。

这里暂时不展开 lookup 的具体实现。dentry cache、父目录 inode 的 `lookup()`、符号链接、挂载点切换以及 RCU 路径查找都属于较重的主题，后续将单独讨论。本节只使用它们的结果，说明几个核心结构之间的依赖关系。

### `do_open()`：检查并打开最终对象

路径解析完成后，`do_open()` 接收已经准备好的 `nd->path`，负责检查最终对象是否符合打开请求，并执行真正的打开操作。它并不负责从路径字符串中逐级寻找最终的 `dentry`。

首先，`do_open()` 会完成路径遍历的收尾，并根据最终目录项的类型检查打开请求：

```c
if (!(file->f_mode & (FMODE_OPENED | FMODE_CREATED))) {
    error = complete_walk(nd);
    if (error)
        return error;
}

if (d_is_dir(nd->path.dentry))
    return -EISDIR;

if ((open_flag & __O_REGULAR) &&
    !d_is_reg(nd->path.dentry))
    return -EFTYPE;
```

这里的 `nd->path.dentry` 已经是路径解析得到的最终目录项。VFS 可以通过它关联的 inode 判断目标是普通文件、目录还是其他类型的文件系统对象。

接下来，`may_open()` 会根据挂载信息、inode 和打开标志检查访问权限：

```c
error = may_open(idmap, &nd->path, acc_mode, open_flag);
```

例如，打开模式是否允许当前访问、是否满足 `O_CREAT` 或 `O_TRUNC` 的条件，都会在这一阶段参与检查。

权限检查通过后，`do_open()` 调用 `vfs_open()`：

```c
if (!error && !(file->f_mode & FMODE_OPENED))
    error = vfs_open(&nd->path, file);
```

这是 `path` 与 `file_operations` 建立联系的关键位置。`vfs_open()` 使用最终的 `path` 初始化 `file`，并使 `file->f_op` 指向当前文件对象对应的操作函数表。之后的 `read()`、`write()` 和 `ioctl()` 等操作，就可以通过这些函数指针进入具体文件系统或设备的实现。

如果打开参数包含 `O_TRUNC`，并且前面的检查全部通过，函数最后才会执行截断：

```c
if (!error && do_truncate)
    error = handle_truncate(idmap, file);
```

因此，`do_open()` 的作用可以概括为：

```text
已经解析好的 nd->path
  → 检查最终 dentry/inode 类型
  → 检查权限和打开标志
  → vfs_open()
      → 初始化 file
      → 连接 file_operations
  → 必要时执行 truncate
```

## 六个核心结构之间的关系

到这里，可以把 `openat()` 中几个核心结构之间的依赖关系集中表示出来：

```text
struct file
  └── f_path（struct path）
        ├── mnt（vfsmount）
        └── dentry
              └── inode
                    └── i_sb → super_block
```

这个图表达的是对象之间的引用关系，而不是说它们在内核中组成一个单一的结构体：

- `file` 表示一次打开文件的内核状态；
- `file->f_path` 保存当前文件的位置；
- `path` 由 `mnt` 和 `dentry` 共同组成；
- `dentry` 表示路径中的目录项，并指向对应的 `inode`；
- `inode` 表示文件、目录或其他文件系统对象；
- `inode->i_sb` 指向所属的 `super_block`，表示该对象属于哪个文件系统实例。

这个关联可以直接表示为：

```c
struct inode *inode = nd->path.dentry->d_inode;
struct super_block *sb = inode->i_sb;
```

因此，`super_block` 不是路径解析过程中根据文件名单独查找出来的对象，而是通过最终 `dentry` 对应的 `inode` 关联得到的文件系统实例。

`file_operations` 不属于本文选择的六个核心结构，而是 `file` 执行后续操作时依赖的函数表：

```text
file
  └── f_op → file_operations
                ├── read()
                ├── write()
                └── ioctl()
```

同样，文件描述符也不是这六个核心结构之一。它只是用户空间用来索引当前进程文件描述符表中 `struct file` 的整数句柄：

```text
文件描述符
  → 当前进程的 fdtable
      → struct file
```

当 `path_openat()` 成功返回 `struct file` 后，更外层的 `do_sys_openat2()` 才会把它安装到当前进程的文件描述符表中，最后把文件描述符返回给用户空间。

因此，本文目前真正关注的是下面这条关系：

```text
openat()
  → path_openat()
      → struct file
          └── f_path
                ├── mnt / vfsmount
                └── dentry → inode → super_block
          └── f_op → file_operations
```

## 从 `O_CREAT` 理解核心对象的创建与连接
