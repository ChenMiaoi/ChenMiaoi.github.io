---
slug: CephV10-2-1-Universal-Modules.en
title: 'CephV10.2.1: Universal Modules'
published: 2024-10-14
tags:
  - ceph
  - distribute system
category: cephv10.2.1
series: cephv10-2-1
lang: "en"
---
**This chapter introduces some complex and commonly used data structures in the Ceph source code**.

## Object

In Ceph, an Object is by default a data block of $4MB$ in size, and **one object corresponds to a single file in the local file system**. In the actual code, there are many different types of Objects.

### object

[object_t](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/include/object.h#L32) corresponds to a file in the local file system, where the field $name$ is the object name.

```cpp
struct object_t {
  string name;

  object_t() {}
  // cppcheck-suppress noExplicitConstructor
  object_t(const char *s) : name(s) {}
  // cppcheck-suppress noExplicitConstructor
  object_t(const string& s) : name(s) {}

  void swap(object_t& o) {
    name.swap(o.name);
  }
  void clear() {
    name.clear();
  }
  
  void encode(bufferlist &bl) const;
  void decode(bufferlist::iterator &bl);
};
WRITE_CLASS_ENCODER(object_t)
```

Here, $object_t$ provides the main constructors along with the two primary methods `encode` and `decode`; through the `WRITE_CLASS_ENCODER` macro, it also implements the external invocation of `encode` and `decode`.

Of course, $object_t$ also overloads the comparison operators and output, making it convenient to compare and print.

### sobject_t

[sobject_t](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/include/object.h#L135) adds $snapshot$ information on top of $object_t$, **used to indicate whether it is a snapshot object**.

Before formally introducing $sobject_t$, we should first take a look at the [snapid_t](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/include/object.h#L113) type.

```cpp
struct snapid_t {
  uint64_t val;
  // cppcheck-suppress noExplicitConstructor
  snapid_t(uint64_t v=0) : val(v) {}
  snapid_t operator+=(snapid_t o) { val += o.val; return *this; }
  snapid_t operator++() { ++val; return *this; }
  operator uint64_t() const { return val; }  
};

inline void encode(snapid_t i, bufferlist &bl) { encode(i.val, bl); }
inline void decode(snapid_t &i, bufferlist::iterator &p) { decode(i.val, p); }

#define CEPH_SNAPDIR ((__u64)(-1))  /* reserved for hidden .snap dir */
#define CEPH_NOSNAP  ((__u64)(-2))  /* "head", "live" revision */
#define CEPH_MAXSNAP ((__u64)(-3))  /* largest valid snapid */

inline ostream& operator<<(ostream& out, snapid_t s) {
  if (s == CEPH_NOSNAP)
    return out << "head";
  else if (s == CEPH_SNAPDIR)
    return out << "snapdir";
  else
    return out << hex << s.val << dec;
}
```

As you can see, $snapid_t$ is actually just a wrapper around a `uint64_t` variable; what we mainly care about is the overloaded output at the end:

- `CEPH_SNAPDIR` identifies the snapshot directory (a hidden `.snap` directory), used to store snapshots
- `CEPH_NOSNAP` means no snapshot, i.e., the latest version of the file or object (called $head$ or $live\ revision$)
- Otherwise, the hexadecimal value of the snapshot ID is printed

Now that we understand $snapid_t$, let's go back and look at the contents of $sobject_t$:

```cpp
struct sobject_t {
  object_t oid;
  snapid_t snap;

  sobject_t() : snap(0) {}
  sobject_t(object_t o, snapid_t s) : oid(o), snap(s) {}

  void swap(sobject_t& o) {}

  void encode(bufferlist& bl) const {}
  void decode(bufferlist::iterator& bl) {}
};
WRITE_CLASS_ENCODER(sobject_t)
```

$sobject_t$ is almost the same as $object_t$, except that it carries additional $snapid_t$ information. Note that the `encode` and `decode` of $sobject_t$ also need to handle the `snapshot` information.

**If an object is not a snapshot object (that is, the object is the $head$), then this `snap` field should be set to `CEPH_NOSNAP`**.

### hobject_t

[hobject_t](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/hobject.h#L37) is the most complex object identifier structure in Ceph. It contains not only the object name and snapshot information, but also the hash value, hash seed, namespace, the object's location in the storage pool, and so on. $hobject_t$ **is the core data structure Ceph uses to uniquely identify and manage object storage; it is used directly by Ceph's $CRUSH$ algorithm to determine the physical storage location of objects**.

```cpp
struct hobject_t {
  object_t oid;
  snapid_t snap;
private:
  uint32_t hash;
  bool max;
  uint32_t nibblewise_key_cache;
  uint32_t hash_reverse_bits;
  static const int64_t POOL_META = -1;
  static const int64_t POOL_TEMP_START = -2; // and then negative
  friend class spg_t;  // for POOL_TEMP_START
public:
  int64_t pool;
  string nspace;

private:
  string key;
};
```

- oid
  - The unique identifier of the object
- snap
  - The snapshot ID
- hash
  - The hash value used to locate the object; combined with the $CRUSH$ algorithm, it determines the object's storage location
  - **`hash` and `key` cannot be set at the same time; `hash` is generally set to the ID of the $PG$**
- max
  - Indicates whether the object is some kind of maximum value
- nibblewise_key_cache
  - A cache field, possibly used for some optimization to speed up object location or hash computation
- hash_reverse_bits
  - Stores the bit-reversed version of the object's hash value. This may be used in certain hash or sorting algorithms
- pool
  - The ID of the storage pool the object belongs to. Ceph supports multiple types of storage pools, and each pool can have different redundancy and distribution policies; this field records which pool the object belongs to
- nspace
  - The object's namespace. Namespaces allow objects to be further subdivided within the same storage pool, providing finer-grained management and isolation
  - Usually empty; used to identify special objects
- key
  - A special marker for the object

The more important functions in $hobject_t$ are:

- `set_hash`
- `match_hash`
- `build_hash_cache`
- `_reverse_bits`
- `_reverse_nibbles`
- `cmp_bitwise`
- `cmp_nibblewise`
- `parse`

In $hobject_t$, `set_hash` calls the `build_hash_cache` function based on the passed-in `hash` value; this function computes the values of `nibblewise_key_cache` and `hash_reverse_bits` by calling `_reverse_nibbles` and `_reverse_bits` respectively:

```cpp
static uint32_t _reverse_bits(uint32_t v) {
  if (v == 0)
    return v;
  // reverse bits
  // swap odd and even bits
  v = ((v >> 1) & 0x55555555) | ((v & 0x55555555) << 1);
  // swap consecutive pairs
  v = ((v >> 2) & 0x33333333) | ((v & 0x33333333) << 2);
  // swap nibbles ...
  v = ((v >> 4) & 0x0F0F0F0F) | ((v & 0x0F0F0F0F) << 4);
  // swap bytes
  v = ((v >> 8) & 0x00FF00FF) | ((v & 0x00FF00FF) << 8);
  // swap 2-byte long pairs
  v = ( v >> 16             ) | ( v               << 16);
  return v;
}
static uint32_t _reverse_nibbles(uint32_t retval) {
  // reverse nibbles
  retval = ((retval & 0x0f0f0f0f) << 4) | ((retval & 0xf0f0f0f0) >> 4);
  retval = ((retval & 0x00ff00ff) << 8) | ((retval & 0xff00ff00) >> 8);
  retval = ((retval & 0x0000ffff) << 16) | ((retval & 0xffff0000) >> 16);
  return retval;
}
```

As for `_reverse_bits`, it performs the following on the `uint32_t` value:

- Swap odd and even bits
- Swap adjacent pairs of bits
- Swap nibbles
- Swap every 8 bits
- Swap every 16 bits

As for `_reverse_nibbles`, it performs the following on the `uint32_t` value:

- Swap each nibble
- Swap every 8 bits
- Swap every 16 bits

As for `match_hash`, it is mainly used to compare whether the lowest specified `bits` number of bits are equal:

```cpp
static bool match_hash(uint32_t to_check, uint32_t bits, uint32_t match) {
  return (match & ~((~0)<<bits)) == (to_check & ~((~0)<<bits));
}
bool match(uint32_t bits, uint32_t match) const {
  return match_hash(hash, bits, match);
}
```

`cmp_nibblewise` compares the magnitude relationship of two $hobject_t$ objects in terms of `max`, `pool`, `nibblewise_key`, `nspace`, `key`, `oid`, and `snap`; `cmp_bitwise` simply replaces the comparison of `nibblewise_key` with the comparison of `bitwise_key`.

Based on these two functions, functors are implemented to serve as comparators: `NibblewiseComparator`, `BitwiseComparator`, and `Comparator`.

Finally, the `parse` function is used to parse a string in the following format:

```cpp
MIN/MAX/pool_id:hash:namespace:key:object_name:snap_id
```

### ghobject_t

[ghobject_t](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/hobject.h#L349) is a wrapper around $hobject_t$, adding the `generation` field and the `shard_id` field:

```cpp
struct ghobject_t {
  hobject_t hobj;
  gen_t generation;
  shard_id_t shard_id;
  bool max;
};
```

- **$ghobject_t$ is mainly used for $PG$s in $ErasureCode$ mode**
- generation
  - Records the version number of the object. **When a $PG$ is $EC$, a write operation needs to distinguish between the two versions of the $object$ before and after the write; the write operation saves the previous version of the object, so that if the write fails, it can be rolled back ($rollback$) to the previous version**
- shard_id
  - Identifies the ordinal number of the $OSD$ where the object resides within an $EC$-type $PG$; for $EC$, each OSD's ordinal number in the $PG$ is critical during data recovery.
  - If it is a $Replicated$-type $PG$, this field is set to `NO_SHARD`

In $ghobject_t$, only two functions deserve special attention: `make_pgmeta` and `parse`

```cpp
static ghobject_t make_pgmeta(int64_t pool, uint32_t hash, shard_id_t shard) {
  hobject_t h(object_t(), string(), CEPH_NOSNAP, hash, pool, string());
  return ghobject_t(h, NO_GEN, shard);
}
```

And this `parse` is used to parse a string like this:

```cpp
GHMIN/GHMAX/shard_id#object_id:hash:namespace:key:object_name:snap_id#generation_id
```

## Buffer

In the actual Ceph source code, Buffer is a namespace containing many related data structures; the most fundamental of them is `buffer::raw`.

### buffer::raw

[buffer::raw](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/buffer.cc#L162) is used to represent and manage a block of memory that stores data. It includes functionality for data management, copying, and CRC checksumming.

```cpp
class buffer::raw {
public:
  char *data;
  unsigned len;
  atomic_t nref;

  mutable simple_spinlock_t crc_spinlock;
  map<pair<size_t, size_t>, pair<uint32_t, uint32_t> > crc_map;
};
```

- data
  - Maintains the data buffer
- len
  - The length of the current data
- nref
  - Reference count
- crc_spinlock
  - A simple $spinlock$
- crc_map
  - CRC checksum information; the first `pair` is the start and end of the data segment, and the second `pair` is the crc32 checksum: the first field is the $base\ crc32$ checksum, and the second field is the crc32 checksum computed after adding the data segment.

Note: $buffer::raw$ **does not allow copying**.

$buffer::raw$ provides the following functions:

```cpp
virtual char *get_data() {
  return data;
}
virtual raw* clone_empty() = 0;
raw *clone() {
  raw *c = clone_empty();
  memcpy(c->data, data, len);
  return c;
}

virtual bool can_zero_copy() const {}
virtual int zero_copy_to_fd(int fd, loff_t *offset) {}
virtual bool is_page_aligned() {}
bool is_n_page_sized() {}
virtual bool is_shareable() {} 

bool get_crc(const pair<size_t, size_t> &fromto,
     pair<uint32_t, uint32_t> *crc) const {
  simple_spin_lock(&crc_spinlock);
  map<pair<size_t, size_t>, pair<uint32_t, uint32_t> >::const_iterator i =
  crc_map.find(fromto);
  if (i == crc_map.end()) {
      simple_spin_unlock(&crc_spinlock);
      return false;
  }
  *crc = i->second;
  simple_spin_unlock(&crc_spinlock);
  return true;
}
void set_crc(const pair<size_t, size_t> &fromto,
     const pair<uint32_t, uint32_t> &crc) {
  simple_spin_lock(&crc_spinlock);
  crc_map[fromto] = crc;
  simple_spin_unlock(&crc_spinlock);
}
void invalidate_crc() {
  simple_spin_lock(&crc_spinlock);
  if (crc_map.size() != 0) {
    crc_map.clear();
  }
  simple_spin_unlock(&crc_spinlock);
}
```

#### raw_malloc

[raw_malloc](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/buffer.cc#L291) is a wrapper for allocating buffers for $buffer::raw$; it is actually controlled by $buffer::raw$ together with three global variables.

```cpp
static atomic_t buffer_total_alloc;
static atomic64_t buffer_history_alloc_bytes;
static atomic64_t buffer_history_alloc_num;
const bool buffer_track_alloc = get_env_bool("CEPH_BUFFER_TRACK");

class buffer::raw_malloc : public buffer::raw {};
```

#### buffer::raw_combined

[buffer::raw_combined](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/buffer.cc#L246) **stores the data buffer within a single memory allocation; its design goal is to manage data and metadata together in memory, optimizing memory allocation and access performance**.

```cpp
class buffer::raw_combined : public buffer::raw {
  size_t alignment;
};
```

On some platforms, data needs to be aligned to specific byte boundaries in order to improve performance or meet hardware requirements.

The most important function in this structure is `create`:

```cpp
static raw_combined *create(unsigned len, unsigned align=0) {
  if (!align)
    align = sizeof(size_t);
  size_t rawlen = ROUND_UP_TO(sizeof(buffer::raw_combined),
              alignof(buffer::raw_combined));
  size_t datalen = ROUND_UP_TO(len, alignof(buffer::raw_combined));

#ifdef DARWIN
  char *ptr = (char *) valloc(rawlen + datalen);
#else
  char *ptr = 0;
  int r = ::posix_memalign((void**)(void*)&ptr, align, rawlen + datalen);
  if (r)
    throw bad_alloc();
#endif /* DARWIN */
  if (!ptr)
    throw bad_alloc();

  // actual data first, since it has presumably larger alignment restriction
  // then put the raw_combined at the end
  return new (ptr + datalen) raw_combined(ptr, len, align);
}
```

If no alignment is specified, we use `sizeof(size_t)` as the default alignment size. Then `ROUND_UP_TO` is used to compute the aligned size of the space to be allocated and the size of this data structure's metadata; the corresponding memory space ($rawlen+datalen$) is then allocated, and through placement $new$, the data structure's metadata is placed at the end of the buffer.

#### buffer::raw_mmap_pages

[buffer::raw_mmap_pages](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/buffer.cc#L320) implements `mmap` to anonymously map memory into the process's address space; it is dedicated to handling memory-mapped pages.

```cpp
data = (char*)::mmap(NULL, len, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANON, -1, 0);
```

Its core code is just the single line above: it calls the `mmap` interface, setting the permissions to a readable, writable, private, and anonymous mapping.

#### buffer::raw_posix_aligned

[buffer::raw_posix_aligned](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/buffer.cc#L340) calls `posix_memalign` to allocate memory with aligned addresses.

Its core code is:

```cpp
align = _align;
assert((align >= sizeof(void *)) && (align & (align - 1)) == 0);
::posix_memalign((void**)(void*)&data, align, len);
```

#### buffer::raw_pipe

[buffer::raw_pipe](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/buffer.cc#L402) uses the pipe mechanism to implement a memory buffer.

What we need to pay attention to here is how the pipe is initialized and how it is copied:

```cpp
explicit raw_pipe(unsigned len) : raw(len), source_consumed(false) {
  size_t max = get_max_pipe_size();
  if (len > max) {
    bdout << "raw_pipe: requested length " << len
          << " > max length " << max << bendl;
    throw malformed_input("length larger than max pipe size");
  }
  pipefds[0] = -1;
  pipefds[1] = -1;

  int r;
  if (::pipe(pipefds) == -1) {
    r = -errno;
    bdout << "raw_pipe: error creating pipe: " << cpp_strerror(r) << bendl;
    throw error_code(r);
  }

  r = set_nonblocking(pipefds);
  if (r < 0) {
    bdout << "raw_pipe: error setting nonblocking flag on temp pipe: "
          << cpp_strerror(r) << bendl;
    throw error_code(r);
  }

  r = set_pipe_size(pipefds, len);
  if (r < 0) {
    bdout << "raw_pipe: could not set pipe size" << bendl;
    // continue, since the pipe should become large enough as needed
  }

  inc_total_alloc(len);
  inc_history_alloc(len);
  bdout << "raw_pipe " << this << " alloc " << len << " "
    << buffer::get_total_alloc() << bendl;
}
```

At the very beginning, we need to obtain the maximum capacity of the pipe

```cpp
static atomic_t buffer_max_pipe_size;
int update_max_pipe_size() {
#ifdef CEPH_HAVE_SETPIPE_SZ
  char buf[32];
  int r;
  std::string err;
  struct stat stat_result;
  if (::stat("/proc/sys/fs/pipe-max-size", &stat_result) == -1)
    return -errno;
  r = safe_read_file("/proc/sys/fs/", "pipe-max-size",
             buf, sizeof(buf) - 1);
  if (r < 0)
    return r;
  buf[r] = '\0';
  size_t size = strict_strtol(buf, 10, &err);
  if (!err.empty())
    return -EIO;
  buffer_max_pipe_size.set(size);
#endif
  return 0;
}

size_t get_max_pipe_size() {
#ifdef CEPH_HAVE_SETPIPE_SZ
  size_t size = buffer_max_pipe_size.read();
  if (size)
    return size;
  if (update_max_pipe_size() == 0)
    return buffer_max_pipe_size.read();
#endif
  // this is the max size hardcoded in linux before 2.6.35
  return 65536;
}
```

In Linux, the maximum capacity of a pipe is written in `/proc/sys/fs/pipe-max-size`, so we only need to read this file, save its value into `buffer_max_pipe_size`, and then return it via `get_max_pipe_size`.

Then we need to create the pipe, set its attributes to non-blocking mode, and attempt to set the pipe size.

```cpp
int set_pipe_size(int *fds, long length) {
#ifdef CEPH_HAVE_SETPIPE_SZ
  if (::fcntl(fds[1], F_SETPIPE_SZ, length) == -1) {
    int r = -errno;
    if (r == -EPERM) {
      // pipe limit must have changed - EPERM means we requested
      // more than the maximum size as an unprivileged user
      update_max_pipe_size();
      throw malformed_input("length larger than new max pipe size");
    }
    return r;
  }
#endif
  return 0;
}
```

For copying a pipe, we need to perform the following operations:

```cpp
char *copy_pipe(int *fds) {
  /* preserve original pipe contents by copying into a temporary
   * pipe before reading.
   */
  int tmpfd[2];
  int r;

  assert(!source_consumed);
  assert(fds[0] >= 0);

  if (::pipe(tmpfd) == -1) {
    r = -errno;
    bdout << "raw_pipe: error creating temp pipe: " << cpp_strerror(r)
          << bendl;
    throw error_code(r);
  }
  r = set_nonblocking(tmpfd);
  if (r < 0) {
    bdout << "raw_pipe: error setting nonblocking flag on temp pipe: "
          << cpp_strerror(r) << bendl;
    throw error_code(r);
  }
  r = set_pipe_size(tmpfd, len);
  if (r < 0) {
    bdout << "raw_pipe: error setting pipe size on temp pipe: "
          << cpp_strerror(r) << bendl;
  }
  int flags = SPLICE_F_NONBLOCK;
  if (::tee(fds[0], tmpfd[1], len, flags) == -1) {
    r = errno;
    bdout << "raw_pipe: error tee'ing into temp pipe: " << cpp_strerror(r)
          << bendl;
    close_pipe(tmpfd);
    throw error_code(r);
  }
  data = (char *)malloc(len);
  if (!data) {
    close_pipe(tmpfd);
    throw bad_alloc();
  }
  r = safe_read(tmpfd[0], data, len);
  if (r < (ssize_t)len) {
    bdout << "raw_pipe: error reading from temp pipe:" << cpp_strerror(r)
          << bendl;
    free(data);
    data = NULL;
    close_pipe(tmpfd);
    throw error_code(r);
  }
  close_pipe(tmpfd);
  return data;
}
```

We need to create a temporary pipe, then copy the data from the original pipe into this temporary pipe so that it can be read. Likewise, we need to set the temporary pipe to non-blocking mode and set its size.

Through the `tee` system call, the contents of the original pipe `fds[0]` are copied into the write end of the temporary pipe `tmpfd[1]`, and then the data is read from `tmpfd[0]`.

### buffer::ptr

[buffer::ptr](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/include/buffer.h#L164) is a kind of slice of $buffer::raw$; it can be illustrated as follows:

![raw and ptr](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202410141431478.png)

```cpp
class CEPH_BUFFER_API ptr {
  raw *_raw;
  unsigned _off, _len;
};
```

- _off
  - This field is the offset from the $buffer::raw$ data pointer
- _len
  - Its length

### buffer::list

[buffer::list](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/include/buffer.h#L261) is a widely used class: it is a list of multiple $buffer::ptr$s, that is, a list of multiple memory data segments.

```cpp
class CEPH_BUFFER_API list {
  // my private bits
  std::list<ptr> _buffers;
  unsigned _len;
  unsigned _memcopy_count;    //the total of memcopy using rebuild().
  ptr append_buffer;          // where i put small appends.
  
  mutable iterator last_p;
};
```

- _buffers
  - Holds all the ptrs
- _len
  - The total data length of all ptrs
- _memcopy_count
  - The amount of data that needs to be copied when the `rebuild` function is called for memory alignment
- append_buffer
  - Small pieces of data are appended to this buffer
- last_p
  - An iterator for accessing the list

The most important part of this structure is how the list is manipulated, so we will mainly explore:

- `push_front/back`
- `rebuld`
- `append`
- `write/read`

#### push_front/back

For `push_front`, we only need to call `vector::push_front` to insert; if it is a $buffer::raw$ type, it is first wrapped in a $buffer:ptr$ before being handled.

Naturally, `push_back` works the same way.

#### rebuild

The `rebuild` function is mainly used to reorganize and merge the internal data in an aligned manner; it mainly relies on [buffer::raw_posix_aligned](#bufferraw_posix_aligned), and then copies each piece of data into it via $buffer::ptr::copy_in$

```cpp
for (std::list<ptr>::iterator it = _buffers.begin(); it != _buffers.end(); ++it) {
  nb.copy_in(pos, it->length(), it->c_str(), false);
  pos += it->length();
}
_memcopy_count += pos;
_buffers.clear();
if (nb.length())
  _buffers.push_back(nb);
invalidate_crc();
last_p = begin();
```

`rebuild` has another version, `rebuild_aligned_size_and_memory`

```cpp
void buffer::list::rebuild_aligned_size_and_memory(unsigned align_size,
  						   unsigned align_memory) {
  std::list<ptr>::iterator p = _buffers.begin();
  while (p != _buffers.end()) {
    // keep anything that's already align and sized aligned
    if (p->is_aligned(align_memory) && p->is_n_align_sized(align_size)) {
      /*cout << " segment " << (void*)p->c_str()
       << " offset " << ((unsigned long)p->c_str() & (align - 1))
       << " length " << p->length()
       << " " << (p->length() & (align - 1)) << " ok" << std::endl;
      */
      ++p;
      continue;
    }
    
    // consolidate unaligned items, until we get something that is sized+aligned
    list unaligned;
    unsigned offset = 0;
    do {
      /*cout << " segment " << (void*)p->c_str()
             << " offset " << ((unsigned long)p->c_str() & (align - 1))
             << " length " << p->length() << " " << (p->length() & (align - 1))
             << " overall offset " << offset << " " << (offset & (align - 1))
       << " not ok" << std::endl;
      */
      offset += p->length();
      unaligned.push_back(*p);
      _buffers.erase(p++);
    } while (p != _buffers.end() &&
       (!p->is_aligned(align_memory) ||
        !p->is_n_align_sized(align_size) ||
        (offset % align_size)));
    if (!(unaligned.is_contiguous() && unaligned._buffers.front().is_aligned(align_memory))) {
      ptr nb(buffer::create_aligned(unaligned._len, align_memory));
      unaligned.rebuild(nb);
      _memcopy_count += unaligned._len;
    }
    _buffers.insert(p, unaligned._buffers.front());
  }
  last_p = begin();
}
```

- First, we need to check whether the data block is already aligned
  - Whether it is aligned in memory: `is_aligned`
  - Whether it is aligned in size: `is_n_align_sized`
- If one of the data blocks is not aligned, the unaligned data blocks need to be merged and stored using the `unaligned` list
- Check whether the merged data block satisfies the alignment requirements; if not, a new aligned buffer needs to be created
- Insert the aligned data block back into the original list
- Update the iterator position

#### append

Ultimately, `append` internally calls the `push_back` interface. `append` has many overloads that allow various types of parameters to be passed in, which we won't go into here. Most importantly, we need to check whether `append_buffer` has enough space.

```cpp
unsigned gap = append_buffer.unused_tail_length();
```

#### write/read

In $buffer::list$, `write` mainly has three ways of writing: writing to a stream, writing to a file, and writing to an fd; `read` has two ways: reading from a file and reading from an fd.

There is nothing special to explain about the other methods—they are just normal read and write operations—but `write_fd` uses $iovec$.

$iovec$ **is a structure used to describe data buffers in input/output operations, and is commonly used to perform scatter/gather I/O operations**. In I/O operations, **it allows an application to use multiple buffers as input or output, avoiding the need to copy data into a single contiguous buffer**. The $iovec$ structure is typically used with Linux system calls.

```cpp
struct iovec {
  void  *iov_base;  // 指向数据缓冲区的指针
  size_t iov_len;   // 缓冲区的长度
};
```

Scatter-read and gather-write operations are implemented through `readv` and `writev`.

```cpp
iovec iov[IOV_MAX];
int iovlen = 0;
ssize_t bytes = 0;

std::list<ptr>::const_iterator p = _buffers.begin();
while (p != _buffers.end()) {
  if (p->length() > 0) {
    iov[iovlen].iov_base = (void *)p->c_str();
    iov[iovlen].iov_len = p->length();
    bytes += p->length();
    iovlen++;
  }
  ++p;

  if (iovlen == IOV_MAX-1 || p == _buffers.end()) {
    iovec *start = iov;
    int num = iovlen;
    ssize_t wrote;
  retry:
    wrote = ::writev(fd, start, num);
    if (wrote < 0) {
      int err = errno;
      if (err == EINTR)
        goto retry;
      return -err;
    }
    if (wrote < bytes) {
  // partial write, recover!
      while ((size_t)wrote >= start[0].iov_len) {
        wrote -= start[0].iov_len;
        bytes -= start[0].iov_len;
        start++;
        num--;
      }
      if (wrote > 0) {
        start[0].iov_len -= wrote;
        start[0].iov_base = (char *)start[0].iov_base + wrote;
        bytes -= wrote;
      }
      goto retry;
    }
    iovlen = 0;
    bytes = 0;
  }
}
```

## ThreadPool

[ThreadPool](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/WorkQueue.h#L28) can be seen everywhere in Ceph and is extremely important. Before introducing $ThreadPool$, we need to cover some prerequisites.

### Mutex

[Mutex](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/Mutex.h#L34) is Ceph's own implementation of a mutex:

```cpp
class Mutex {
private:
  std::string name;     // 锁的名字
  int id;               // 锁的唯一标识符
  bool recursive;       // 递归锁，允许同一线程多次获取同一锁
  bool lockdep;         // 依赖检测，防止死锁
  bool backtrace;       // gather backtrace on lock acquisition

  pthread_mutex_t _m;   // POSIX MUTEX API
  int nlock;            // 记录锁的嵌套次数，如果是递归锁，则会在加锁时自增
  pthread_t locked_by;  // 记录当前加锁的线程TID
  CephContext *cct;     // Ceph上下文
  PerfCounters *logger; // 性能日志记录器
};
```

Note: $Mutex$ **does not allow copying**.

#### Lock Initialization Process

By default, $Mutex$ does not allow recursive locking, enables dependency checking, and does not collect call stacks

```cpp
Mutex::Mutex(const std::string &n, bool r, bool ld,
	     bool bt,
	     CephContext *cct) :
  name(n), id(-1), recursive(r), lockdep(ld), backtrace(bt), nlock(0),
  locked_by(0), cct(cct), logger(0) {}
```

Since Ceph is monitored by $Valgrind$, we first need to tell $Valgrind$ that the data races on some of our variables in a multithreaded context are expected and safe

```cpp
ANNOTATE_BENIGN_RACE_SIZED(&id, sizeof(id), "Mutex lockdep id");
ANNOTATE_BENIGN_RACE_SIZED(&nlock, sizeof(nlock), "Mutex nlock");
ANNOTATE_BENIGN_RACE_SIZED(&locked_by, sizeof(locked_by), "Mutex locked_by");
```

For now, we won't analyze $CephContext$. Moving on: if we enable the `recursive` feature, then we need to initialize a recursive-type `pthread_mutex_t`, so:

```cpp
if (recursive) {
  pthread_mutexattr_t attr;
  pthread_mutexattr_init(&attr);
  pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_RECURSIVE);
  pthread_mutex_init(&_m,&attr);
  pthread_mutexattr_destroy(&attr);
  if (lockdep && g_lockdep)
    _register();
}
```

This allows the same thread to lock it multiple times, but it must be unlocked the same number of times. If the lock is not recursive but `lockdep` is enabled, a `pthread_mutex_t` with error checking is initialized; this type of lock returns an error when a second lock attempt is made or when unlocking an unlocked mutex, thereby avoiding deadlock or undefined behavior

```cpp
else if (lockdep) {
  pthread_mutexattr_t attr;
  pthread_mutexattr_init(&attr);
  pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_ERRORCHECK);
  pthread_mutex_init(&_m, &attr);
  pthread_mutexattr_destroy(&attr);
  if (g_lockdep)
    _register();
}
```

Now let's look at how `lockdep` registers lock dependency information through `_register`:

```cpp
void _register() {
  id = lockdep_register(name.c_str());
}
```

First, `lockdep_register` takes the name of the lock and eventually returns a unique identifier for the lock. Before performing the actual operations, we need to prevent races on shared data caused by concurrent access, using an additional lock to handle this part of the logic

```cpp
# define PTHREAD_MUTEX_INITIALIZER \
  { { 0, 0, 0, 0, 0, __PTHREAD_SPINS, { 0, 0 } } }
static pthread_mutex_t lockdep_mutex = PTHREAD_MUTEX_INITIALIZER;

int lockdep_register(const char *name) {
  int id;
  pthread_mutex_lock(&lockdep_mutex);
```

Initializing a lock with `PTHREAD_MUTEX_INITIALIZER` is more efficient than calling the initialization interface.

After acquiring the lock, we need to check whether the passed-in lock name already exists in the hash table, which is a globally maintained variable

```cpp
static ceph::unordered_map<std::string, int> lock_ids;
ceph::unordered_map<std::string, int>::iterator p = lock_ids.find(name);
id = p->second;
```

If it exists in the hash table, then we have found the unique identifier of the lock; if not, a unique identifier is allocated from `free_ids`, which is a list ranging from $0 \sim MAX\_LOCKS$

```cpp
if (p == lock_ids.end()) {
  if (free_ids.empty()) {
    lockdep_dout(0) << "ERROR OUT OF IDS .. have " << free_ids.size()
            << " max " << MAX_LOCKS << dendl;
    for (auto& p : lock_names) {
      lockdep_dout(0) << "  lock " << p.first << " " << p.second << dendl;
    }
    assert(free_ids.empty());
  }
  id = free_ids.front();
  free_ids.pop_front();

  lock_ids[name] = id;
  lock_names[id] = name;
  lockdep_dout(10) << "registered '" << name << "' as " << id << dendl;
}
```

Finally, a reference count is maintained in `lock_refs` to indicate how many times a lock has been registered

```cpp
static map<int, int> lock_refs;

++lock_refs[id];
pthread_mutex_unlock(&lockdep_mutex);
return id;
```

#### Lock Destruction Process

Obviously, at the beginning we need to declare to $Valgrind$ that operations on `_m` will not cause lock races.

```cpp
Mutex::~Mutex() {
  assert(nlock == 0);

  // helgrind gets confused by condition wakeups leading to mutex destruction
  ANNOTATE_BENIGN_RACE_SIZED(&_m, sizeof(_m), "Mutex primitive");
  pthread_mutex_destroy(&_m);

  if (cct && logger) {
    cct->get_perfcounters_collection()->remove(logger);
    delete logger;
  }
  if (lockdep && g_lockdep) {
    lockdep_unregister(id);
  }
}
```

If we enabled `lockdep` at the beginning, then when it is finally destroyed, all registered dependencies need to be unregistered

```cpp
void lockdep_unregister(int id)
{
  if (id < 0) {
    return;
  }

  pthread_mutex_lock(&lockdep_mutex);

  map<int, std::string>::iterator p = lock_names.find(id);
  assert(p != lock_names.end());

  int &refs = lock_refs[id];
  if (--refs == 0) {
    lockdep_dout(10) << "unregistered '" << p->second << "' from " << id
                     << dendl;
    lock_ids.erase(p->second);
    lock_names.erase(id);
    lock_refs.erase(id);
    free_ids.push_back(id);
  } else {
    lockdep_dout(20) << "have " << refs << " of '" << p->second << "' "
                     << "from " << id << dendl;
  }
  pthread_mutex_unlock(&lockdep_mutex);
}
```

There is a portion in the middle that clears the $BackTrace$; we won't dig into that here, so it is not shown.

The main thing we do is: once the lock's reference count reaches 0, delete the key-value pair from the `lock_ids` hash table, then delete the records in `lock_names` and `lock_refs`, and append the freed lock identifier back to `free_ids`.

#### Locking Process

Here, we still do not discuss the case of $CephContext$. The `Lock` function takes a `no_lockdep` parameter; if `lockdep` is enabled, $no\_lockdep=false$ will trigger `_will_lock`

```cpp
void Mutex::Lock(bool no_lockdep) {
  if (lockdep && g_lockdep && !no_lockdep) _will_lock();
```

The purpose of the `_will_lock` function is to work with the lock dependency tracking mechanism, informing the system in advance that a lock is about to be acquired, thereby helping Ceph manage and detect lock dependency relationships.

```cpp
void _will_lock() { // about to lock
  id = lockdep_will_lock(name.c_str(), id, backtrace);
}
```

This function passes the lock's name and ID to the `lockdep_will_lock` function. `lockdep_will_lock` internally registers or updates the lock's dependency information, indicating that the lock is about to be acquired by some thread. If backtracing is enabled ($backtrace = true$), Ceph also records the call stack at the time the lock is acquired, which makes later debugging and analysis easier.

At the very beginning, `lockdep_will_lock` obtains the thread TID and checks whether the passed-in lock ID is valid; if it is invalid, a valid lock ID is registered via `lockdep_register`

```cpp
int lockdep_will_lock(const char *name, int id, bool force_backtrace) {
  pthread_t p = pthread_self();
  if (id < 0) id = lockdep_register(name);
```

After confirming that the ID is valid, we obtain the corresponding dependency graph from the maintained `held` table, and then check the dependencies

```cpp
map<int, BackTrace *> &m = held[p];
for (map<int, BackTrace *>::iterator p = m.begin(); p != m.end(); ++p) {
  if (p->first == id) {
    lockdep_dout(0) << "\n";
    *_dout << "recursive lock of " << name << " (" << id << ")\n";
    BackTrace *bt = new BackTrace(BACKTRACE_SKIP);
    bt->print(*_dout);
    if (p->second) {
      *_dout << "\npreviously locked at\n";
      p->second->print(*_dout);
    }
    delete bt;
    *_dout << dendl;
    assert(0);
  }
}
```

If `p->first == id`, it means recursive locking has occurred; in this case, $BackTrace$ prints the name of the recursively locked lock and its corresponding lock ID, and then checks whether the lock was preceded by other locks—if so, it prints their call stacks. If no recursive locking occurred, a new dependency relationship needs to be established

```cpp
else if (!follows[p->first][id]) {}
```

When creating a dependency relationship, we need to determine whether a cycle would occur; `followers[a][b]` indicates that `b` occurs after `a`

```cpp
if (does_follow(id, p->first)) {
  BackTrace *bt = new BackTrace(BACKTRACE_SKIP);
  lockdep_dout(0) << "new dependency " << lock_names[p->first]
      << " (" << p->first << ") -> " << name << " (" << id << ")"
      << " creates a cycle at\n";
  bt->print(*_dout);
  *_dout << dendl;

  lockdep_dout(0) << "btw, i am holding these locks:" << dendl;
  for (map<int, BackTrace *>::iterator q = m.begin(); q != m.end(); ++q) {
    lockdep_dout(0) << "  " << lock_names[q->first] << " (" << q->first << ")" << dendl;
    if (q->second) {
      lockdep_dout(0) << " ";
      q->second->print(*_dout);
      *_dout << dendl;
    }
  }

  lockdep_dout(0) << "\n" << dendl;

  // don't add this dependency, or we'll get aMutex. cycle in the graph, and
  // does_follow() won't terminate.

  assert(0);  // actually, we should just die here.
}
```

Because what we initially checked was `!follower[p->first][id]`, which means `p->first` occurs before the `id` lock, and `dose_follow(id, p->first)` being `True` in turn means `id` occurs before the `p->first` lock; this creates a circular dependency, which would eventually lead to a deadlock.

Once the above dependency checks pass, we can correctly add the dependency relationship, indicating that `id` can be locked.

```cpp
else {
  BackTrace *bt = NULL;
  if (force_backtrace || lockdep_force_backtrace()) {
    bt = new BackTrace(BACKTRACE_SKIP);
  }
  follows[p->first][id] = true;
  follows_bt[p->first][id] = bt;
  lockdep_dout(10) << lock_names[p->first] << " -> " << name << " at" << dendl;
  //bt->print(*_dout);
}
return id;
```

Now back in the `Lock` function: if `_will_lock` did not trigger a $BackTrace$, it means this `id` can be locked correctly, so we can call the locking API

```cpp
r = pthread_mutex_lock(&_m);
assert(r == 0);
```

If we have enabled the `lockdep` feature, then after successfully locking, we also need to perform the `_locked` check to record the lock's state and related debugging information

```cpp
if (lockdep && g_lockdep) _locked();

void _locked() {    // just locked
  id = lockdep_locked(name.c_str(), id, backtrace);
}
```

The main core operation is updating the state of the `held` hash table; if the $backtrace$ mechanism is enabled, the $BackTrace$ is saved as well

```cpp
if (force_backtrace || lockdep_force_backtrace())
  held[p][id] = new BackTrace(BACKTRACE_SKIP);
else
  held[p][id] = 0;
```

After updating the lock's state, `_post_lock` also needs to be called to update the lock's holder

```cpp
void _post_lock() {
  if (!recursive) {
    assert(nlock == 0);
    locked_by = pthread_self();
  };
  nlock++;
}
```

Note here that if `recursive` is not enabled, an assertion is made on `nlock`, meaning that acquiring an already-held lock is not allowed.

#### Unlocking Process

Compared to locking, unlocking is much simpler: we need to update the lock's state, then determine whether it can be unlocked, and then unlock it

```cpp
void Mutex::Unlock() {
  _pre_unlock();
  if (lockdep && g_lockdep) _will_unlock();
  int r = pthread_mutex_unlock(&_m);
  assert(r == 0);
}
```

`_pre_unlock` confirms the reference count, and if `recursive` is not enabled, it also releases its holder

```cpp
void _pre_unlock() {
  assert(nlock > 0);
  --nlock;
  if (!recursive) {
    assert(locked_by == pthread_self());
    locked_by = 0;
    assert(nlock == 0);
  }
}
```

Once the unlocking preparation is done, if `lockdep` is enabled, we need to determine whether the dependency conditions allow unlocking

```cpp
void _will_unlock() {  // about to unlock
  id = lockdep_will_unlock(name.c_str(), id);
}
```

Simply delete the record in the `held` hash table

```cpp
delete held[p][id];
held[p].erase(id);
```

#### Locker

[Locker](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/Mutex.h#L110) is a wrapper around $Mutex$, through which `Lock` and `UnLock` can be called directly

### Cond

[Cond](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/Cond.h#L29) is a wrapper for thread synchronization, mainly implemented based on POSIX's `pthread_cond_t` condition variable. Condition variables are used to coordinate the execution order between threads in multithreaded programming, and are used together with $Mutex$

```cpp
class Cond {
  // my bits
  pthread_cond_t _c;
  Mutex *waiter_mutex;
};
```

- _c
  - Wraps `pthread_cond_t`, used for waiting and signaling between threads
- waiter_mutex
  - Points to the $Mutex$ currently associated with this condition variable, **ensuring that a condition variable can only be bound to one mutex**

There is nothing special to explain about the initialization and destruction of $Cond$; of course, $Cond$ **still does not allow copying**.

**Release the lock when entering the wait, and re-acquire the lock after being woken up; this guarantees that modifications to shared resources are thread-safe**. This is also the design principle we need to follow.

#### Wait

[Wait](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/Cond.h#L48) has multiple overloads in $Cond$, but the final operation is handled by code like this

```cpp
int Wait(Mutex &mutex)  { 
  // make sure this cond is used with one mutex only
  assert(waiter_mutex == NULL || waiter_mutex == &mutex);
  waiter_mutex = &mutex;

  assert(mutex.is_locked());

  mutex._pre_unlock();
  int r = pthread_cond_wait(&_c, &mutex._m);
  mutex._post_lock();
  return r;
}
```

Before calling `pthread_cond_wait`, we need to ensure that the $Mutex$ is in an unlocked state, so we use `_pre_lock` to ensure that the information maintained by $Mutex$ represents the unlocked state:

**Because once `pthread_cond_wait` enters the `wait` state, it automatically unlocks; after `pthread_cond_wait` is woken up, it re-acquires the lock, so we need to restore the information previously maintained by $Mutex$ to indicate that it is locked**.

#### Signal

For $Signal$, by calling `pthread_cond_broadcast` or `pthread_cond_signal`, you can choose to wake up all waiting threads or just one waiting thread.

### ThreadPool Structure

Now let's return to the code of $ThreadPool$

```cpp
class ThreadPool : public md_config_obs_t {
  CephContext *cct;
  string name;
  string thread_name;
  string lockname;
  Mutex _lock;
  Cond _cond;
  bool _stop;
  int _pause;
  int _draining;
  Cond _wait_cond;
  int ioprio_class, ioprio_priority;
  
  unsigned int _num_threads;
  string _thread_num_option;
  const char** _conf_keys;
  vector<WorkQueue_*> work_queues;
  int last_work_queue;
  set<WorkThread*> _threads;
  list<WorkThread*> _old_threads;
  int processing;
};
```

- name
  - The name of the thread pool
- lockname
  - The name of the lock
- _lock
  - The mutex for threads, and also the mutex for accessing work queues
- _cond
  - The condition variable corresponding to the lock, used to control concurrency
- _stop
  - Whether to stop the thread pool
- _pause
  - Temporarily pause the thread pool
- _draining
  - Before stopping the thread pool, wait for already-submitted tasks to finish executing
- _wait_cond
  - Usually used in scenarios where we wait for all threads to finish or for the task queue to be emptied
- ioprio_class, ioprio_priority
  - ioprio_class indicates the I/O priority class, such as real-time priority ($IOPRIO\_CLASS\_RT$), best-effort priority ($IOPRIO\_CLASS\_BE$), or idle priority ($IOPRIO\_CLASS\_IDLE$)
  - ioprio_priority is the specific priority value, usually an integer; the smaller the value, the higher the priority
- _num_threads
  - The number of threads in the thread pool. This value determines how many worker threads are created when the thread pool starts. The pool size can be adjusted dynamically, and can also be set through configuration files or parameters.
- _thread_num_option
  - The name of the thread-count configuration option
- _conf_keys
  - An array of pointers to configuration keys, possibly used to watch or monitor configuration changes related to the thread pool
- work_queues
  - The set of task queues; each task queue ($WorkQueue\_$) usually represents a group of pending work items. $ThreadPool$ distributes tasks to threads through these task queues.
- last_work_queue
  - Records the index of the last scheduled task queue. When the thread pool handles multiple task queues, it usually polls these queues in turn to select the next queue to process
- _threads
  - The set of currently running worker threads
- _old_threads
  - A list of old threads, possibly used to manage threads that are about to exit or have already stopped
- processing
  - The number of tasks currently being processed

#### TPHandle

[ThreadPoolHandle](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/WorkQueue.h#L42) is mainly used to monitor and manage the thread pool's timeout, heartbeat mechanism, and other functions. It interacts with the ThreadPool to control the thread pool's timeout behavior and prevents threads in the pool from being unresponsive for long periods.

```cpp
class TPHandle {
  friend class ThreadPool;
  CephContext *cct;       // Ceph全局上下文信息
  heartbeat_handle_d *hb; // 心跳机制处理句柄
  time_t grace;           // 表示宽限时间（grace period）的变量,用于控制线程的最大响应时间
  time_t suicide_grace;   // 用于控制线程的“自杀”时间，即当线程长时间不响应时，
                          // 系统可能会采取强制终止的手段，确保系统的整体健康
};
```

##### heartbeat_handle_d

First, we need to figure out what this `heartbeat_handle_d` thing actually does. If you are familiar with [Raft](https://en.wikipedia.org/wiki/Raft_(algorithm)), you should already know what the heartbeat mechanism is for:

**It is used to keep the Leader and Followers in a cluster synchronized, and to ensure that the cluster can operate normally in a consistent state**.

```cpp
struct heartbeat_handle_d {
  const std::string name;
  atomic_t timeout, suicide_timeout;
  time_t grace, suicide_grace;
  std::list<heartbeat_handle_d*>::iterator list_item;

  explicit heartbeat_handle_d(const std::string& n)
    : name(n), grace(0), suicide_grace(0)
  { }
};
```

Judging from the structure of `heartbeat_handle_d`, it mainly manages a maintainable time sequence.

`timeout` represents the regular heartbeat timeout. Within the timeout period, a component or thread must send a heartbeat signal, otherwise the system considers it unavailable; `grace` represents the grace period. The grace period is a length of time during which a component or thread is allowed to keep running without sending heartbeat signals. Within the grace period, even if no heartbeat signal is received, the system will not immediately declare the thread dead. It is a buffering mechanism that prevents brief delays or network fluctuations from causing unnecessary timeouts.

Once the timeout has elapsed, if the component or thread still has not sent a heartbeat signal within `suicide_timeout`, the system may take more drastic measures, such as forcibly terminating the thread or marking it as failed. `suicide_grace` is a grace period similar to `grace`, but it is associated with `suicide`

---  

Now, let's return to the implementation of $TPHandle$, which mainly provides two functions for handling the heartbeat mechanism: `reset_tp_timeout` and `suspend_tp_timeout`

Internally, `reset_tp_timeout` is implemented by $CephContext$ calling `reset_timeout()`, because $CephContext$ manages the global heartbeat information, so it should be modified globally; this function is used to **reset the heartbeat timeout and set a new grace time** (if any):

```cpp
cct->get_heartbeat_map()->reset_timeout(hb, grace, suicide_grace);
```

Similarly, `suspend_tp_timeout` is also implemented by $CephContext$ calling `clear_timeout()`; its purpose is to clear the timeout and grace times

```cpp
cct->get_heartbeat_map()->clear_timeout(hb);
```

#### WorkQueue_

[WorkQueue_](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/WorkQueue.h#L61) is the basic interface of a work queue in Ceph, used by worker threads. In a distributed system like Ceph, work queues are typically used to manage tasks that need to be processed. This interface defines the core operations and abstract methods related to queue management and task processing; the concrete implementations are completed by classes that inherit this interface.

Among them, `timeout_interval` represents the task timeout in the work queue. Each task should not stay in the queue longer than this time; if it times out, a warning or other recovery mechanism may be triggered. `suicide_interval` represents the suicide interval. If a queue remains unresponsive for a long time or tasks are processed too slowly, measures such as terminating processing or reclaiming resources may be taken based on this time.

No matter which kind of $WorkQueue$ it is, we only need to remember:

**When enqueueing, you need to add the task and wake up a thread to process it**.

##### BatchWorkQueue

[BatchWorkQueue](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/WorkQueue.h#L101) is used to process a batch of work items. This class uses generic templates to flexibly adapt to different types of work items and provides a mechanism for batch processing tasks

$BatchWorkQueue$ is actually still a base class, mainly used to be instantiated by Work that requires batch processing.

The functions we need to pay attention to are probably:

- `queue` and `dequeue`
- `_enqueue` and `_dequeue`, which need to be implemented by derived classes
- `_process` and `_process_finish`, which need to be implemented by derived classes

##### WorkQueueVal_

[WorkQueueVal_](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/WorkQueue.h#L182) is dedicated to processing tasks passed by value. Unlike other work queues, it supports task processing of value types (rather than pointer types) through template parameters, making it suitable for handling smaller task objects that occupy less memory.

This type has two additional members for managing the task queue:

- `to_process`: the task processing list, which stores the tasks to be processed. When a task is taken out of the queue, it is placed into the `to_process` list.
- `to_finish`: the task completion list, which stores tasks that have been processed but not yet finished. After a task is processed, it is moved into this list for further follow-up processing.

Similar to the above, this also requires concrete implementations of the various actual operations; however, when enqueueing and dequeueing, the `to_process` and `to_finish` logic needs to be filled in according to the actual situation.

##### WorkQueue

[WorkQueue](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/WorkQueue.h#L266) is mainly used to handle work items that are large or contain dynamically allocated memory.

**This class is suitable for scenarios that need to process large amounts of data asynchronously, such as the background tasks that handle storage requests in Ceph; it can effectively manage dynamically allocated memory and ensure concurrent task processing**.

##### PointerWQ

[PointerWQ](https://github.com/ceph/ceph/blob/3a66dd4f30852819c1bdaa8ec23c795d4ad77269/src/common/WorkQueue.h#L346) implements a work queue in which work items are submitted by pointer. This class is designed mainly to handle work items of type T, and is suitable for scenarios that require dynamic memory management.

Unlike the above, $PointerWQ$ has two additional members for managing internal task information:

- `m_items`: a list storing pointers to work items; a doubly linked list is used to make insertion and deletion at the head and tail of the queue convenient.
- `m_processing`: records the number of work items currently being processed, ensuring thread safety.

#### WorkThread

##### Thread

[Thread](https://github.com/ceph/ceph/blob/c5faa93d2696af5c9c4f130b73e6e13e30e206d7/src/common/Thread.h#L34) is Ceph's wrapper for $POSIX$ threads. **It additionally provides priority handling**.

```cpp
class Thread {
private:
  pthread_t thread_id;
  pid_t pid;
  int ioprio_class, ioprio_priority;
  int cpuid;
  const char *thread_name;
};
```

What we mainly need to pay attention to is how Ceph handles the creation, destruction, and attribute setting of threads:

For thread creation, $Thread$ specially provides `try_create` to handle the core part of creating a thread:

```cpp
stacksize &= CEPH_PAGE_MASK;  // must be multiple of page
  if (stacksize) {
    thread_attr = &thread_attr_loc;
    pthread_attr_init(thread_attr);
    pthread_attr_setstacksize(thread_attr, stacksize);
  }
```

We compare the passed-in thread stack size with the configured page mask to confirm that the passed-in parameter conforms to the specification, and therefore set the thread's stack size attribute.

```cpp
sigset_t old_sigset;
if (g_code_env == CODE_ENVIRONMENT_LIBRARY) {
  block_signals(NULL, &old_sigset);
}
else {
  int to_block[] = { SIGPIPE , 0 };
  block_signals(to_block, &old_sigset);
}
```

**In Ceph, many components rely on multithreading to handle requests (such as storage requests, data replication, etc.). Blocking signals before creating a new thread ensures that the new thread will not be unexpectedly interrupted while executing critical initialization logic, thereby maintaining system stability**.

This allows Ceph to adopt different signal handling strategies under different deployment or runtime modes.

```cpp
r = pthread_create(&thread_id, thread_attr, _entry_func, (void*)this);
restore_sigset(&old_sigset);

if (thread_attr) {
  pthread_attr_destroy(thread_attr);	
}
```

Once it is ensured that the new thread Ceph is about to start will not be interfered with by other threads, the thread can be started, and then the signal state is restored. If thread attributes were set earlier, they need to be destroyed to ensure resource reclamation.

We can see that, through a callback, the thread is started from `_entry_func`, with itself passed in as the argument:

```cpp
void *Thread::_entry_func(void *arg) {
  void *r = ((Thread*)arg)->entry_wrapper();
  return r;
}
```

In the `entry_wrapper` function, the thread's attributes are further configured, and the function that the thread should actually execute is called (this is implemented by derived classes):

```cpp
void *Thread::entry_wrapper() {
  int p = ceph_gettid(); // may return -ENOSYS on other platforms
  if (p > 0)
    pid = p;
  if (pid &&
      ioprio_class >= 0 &&
      ioprio_priority >= 0) {
    ceph_ioprio_set(IOPRIO_WHO_PROCESS,
		    pid,
		    IOPRIO_PRIO_VALUE(ioprio_class, ioprio_priority));
  }
  if (pid && cpuid >= 0)
    _set_affinity(cpuid);

  pthread_setname_np(pthread_self(), thread_name);
  return entry();
}
```

`ceph_gettid` directly calls `SYS_gettid` to obtain the thread ID of the current thread; if it exists and a priority is configured, we need to set the priority:

```cpp
syscall(SYS_ioprio_set, whence, who, ioprio);
```

- `whence` specifies whether it applies to a thread or a process
- `who` specifies which target it applies to
- `ioprio` is the priority

After setting the priority, we also need to deal with the CPU: binding a specific thread to a specific CPU to improve resource utilization

```cpp
cpu_set_t cpuset;
CPU_ZERO(&cpuset);

CPU_SET(id, &cpuset);

if (sched_setaffinity(0, sizeof(cpuset), &cpuset) < 0)
  return -errno;
/* guaranteed to take effect immediately */
sched_yield();
```

Finally, we begin calling `entry`, the entry point of the function that the thread actually needs to execute.

--- 

Now let's return to the $WorkThread$ structure, which mainly implements `entry`.

```cpp
void *entry() {
  pool->worker(this);
  return 0;
}
```

In $WorkThread$, to share data conveniently, we keep the $ThreadPool$ as a pointer member in $WorkThread$, and then perform the $work$ through the $ThreadPool$ (its working principle will be introduced in detail later).

---  

### Start Thread

Up to this point, we have learned all the bits and pieces about $ThreadPool$; now it is time to analyze what $ThreadPool$ actually does.

$ThreadPool$ provides a $start$ function entry as the thread pool's startup function, and this function simply calls $start_thread$

```cpp
WorkThread *wt = new WorkThread(this);
_threads.insert(wt);
int r = wt->set_ioprio(ioprio_class, ioprio_priority);
wt->create(thread_name.c_str());
```

`start_thread` creates a worker thread via $WorkThread$, then sets its priority, and actually creates a $POSIX\ Thread$. The started thread automatically calls the `worker` function; for $ThreadPool$, `worker` is the main core logic:

1. Add the current worker thread to heartbeat management
2. Check and handle threads that have already finished, ensuring the number of threads in the pool stays within the specified range
   1. If the current number of threads exceeds the maximum, record it and hand the thread over to `old_thread` for management
3. Poll the tasks in each work queue in turn
   1. If a task is correctly obtained from the work queue, set the heartbeat time via $TPHandle$ and process it
   2. After processing is complete, the worker needs to wait for the next task
4. When all tasks have been polled, remove this thread from heartbeat management

### Stop Thread

What the `stop` function needs to do is simple: remove itself from the `observer`'s watch, then wake up all threads, let the dormant threads finish their unfinished tasks, and then clean them up one by one.

```cpp
cct->_conf->remove_observer(this);

_cond.Signal();
join_old_threads();
```
