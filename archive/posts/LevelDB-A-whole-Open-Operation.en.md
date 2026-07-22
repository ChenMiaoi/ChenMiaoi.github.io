---
slug: LevelDB-A-whole-Open-Operation.en
title: 'LevelDB: A whole Open Operation'
published: 2024-09-16
tags:
  - leveldb
  - option
category: leveldb
series: leveldb
lang: "en"
---
*I recently got into the field of distributed storage and computing, so I wanted to use LevelDB as my first learning project. At first, I studied through the Feishu document [Hardcore Classroom: LevelDB Source Code Analysis](https://hardcore.feishu.cn/mindnotes/bmncnzpUmXNQruVGOwRwisHyxoh), but I wasn't quite used to the learning order in that document, so I plan to break down the details of the entire LevelDB source code, module by module*.

*The first module is the `DB::Open` operation*. To analyze `Open`, we first need to look from a high-level perspective at what operations `Open` performs.

**`DB::Open` is the core function used to open a database. Its main tasks are to `initialize the database`, `load the database metadata`, recover/repair the database data, `and` ensure the database is in a usable state**.

Let's first look at what the implementation of `DB::Open` actually does from a high-level perspective:

- Step 1: Initialization

```cpp
Status DB::Open(
    const Options& options, 
    const std::string& dbname, 
    DB** dbptr) {
    *dbptr = nullptr;
}
```

The `Open` function sets the `db` handle to be returned to `nullptr` right at the start. This ensures that **if anything goes wrong during the execution of the function, `dbptr` remains `nullptr`, indicating that the database failed to open**.

- Step 2: Create the `DBImpl` database instance

```cpp
DBImpl* impl = new DBImpl(options, dbname);
impl->mutex_.Lock();
```

`DBImpl` is the internal interface of `DB`; it is the actual operational interface, which will be introduced in detail later. We also need to ensure that database operations are safe in a multi-threaded environment, so `DBImpl::mutex_` is locked.

- Step 3: Initialize the recovery operation

```cpp
VersionEdit edit;
bool save_manifest = false;
Status s = impl->Recover(&edit, &save_manifest);
```

In `LevelDB`, the **main role of `VersionEdit` is to record changes to database versions. Specifically, it is used to describe metadata changes to the database, such as file additions and deletions and updates to log numbers. These changes are written to the `MANIFEST` file to ensure that the database state can be rebuilt consistently and reliably when the system restarts or recovers**.

`save_manifest` is used to indicate whether the `MANIFEST` file needs to be updated, while the `Recover` function handles database recovery, **ensuring that the database is in a consistent state**, and decides whether to create the database or report an error based on the `create_if_missing` and `error_if_exists` options.

- Step 4: Create the MemTable and its corresponding log file

```cpp
if (s.ok() && impl->mem_ == nullptr) {
  uint64_t new_log_number = impl->versions_->NewFileNumber();
  WritableFile* lfile;
  s = options.env->NewWritableFile(LogFileName(dbname, new_log_number), &lfile);
  if (s.ok()) {
    edit.SetLogNumber(new_log_number);
    impl->logfile_ = lfile;
    impl->logfile_number_ = new_log_number;
    impl->log_ = new log::Writer(lfile);
    impl->mem_ = new MemTable(impl->internal_comparator_);
    impl->mem_->Ref();
  }
}
```

In `LevelDB`, `MemTable` is a core data structure. **It temporarily stores the data of write operations and flushes it to disk at the appropriate time. `MemTable` is an in-memory `skip list` that supports efficient insertion, lookup, and deletion operations**.

- **When data is written to LevelDB, it is first written into the MemTable rather than directly to disk. This avoids frequent disk I/O and improves write performance**.
- **Data written to the MemTable is also recorded in a log file (WAL, Write-Ahead Log) at the same time, to ensure that data not yet flushed to disk can be recovered from the log file in the event of a crash**.

If the `Recover` operation in step 3 proceeded normally and the database being opened has no corresponding `MemTable`, then a new log file and a new `MemTable` should be created to record operations and store in-memory data, which will later be flushed to disk through the `MemTable`.

- Step 5: Save the `MANIFEST` file

```cpp
if (s.ok() && save_manifest) {
  edit.SetPrevLogNumber(0);
  edit.SetLogNumber(impl->logfile_number_);
  s = impl->versions_->LogAndApply(&edit, &impl->mutex_);
}
```

If the recovery process requires saving the `MANIFEST` file, the function updates the new log file number and applies these changes via `LogAndApply`.

- Step 6: Cleanup and compaction

```cpp
if (s.ok()) {
  impl->RemoveObsoleteFiles();
  impl->MaybeScheduleCompaction();
}
```

If everything is still successful, the function deletes obsolete files (such as old log files) and schedules a compaction operation as needed. Compaction can reduce the database size and improve performance.

- Step 7: Return the DB handle

```cpp
impl->mutex_.Unlock();
if (s.ok()) {
  assert(impl->mem_ != nullptr);
  *dbptr = impl;
} else {
  delete impl;
}
return s;
```

At this point, from a high-level perspective we have understood what `DB::Open` does and the purpose of each of its steps. Now we need to deconstruct the entire `Open` operation in greater detail.

## Options  

`Options` is mainly **used to configure and control the behavior of the database, including read/write performance, resource usage, compression strategies, and more. The `Options` class contains a variety of configuration options, allowing users to customize the database according to their specific needs when creating and using it**.

For `LevelDB::Options`, there are three types of `Options` in the database:

- `Options`: controls global, database-level configuration
- `ReadOptions`: controls the behavior of database read operations
- `WriteOptions`: controls the behavior of database write operations

### Options

First, let's look at the detailed definition of `Options`. `Options` is actually an open struct in which all internal fields are public and modifiable.

```cpp
// Options to control the behavior of a database (passed to DB::Open)
struct LEVELDB_EXPORT Options {
  // Create an Options object with default values for all fields.
  Options();
  const Comparator* comparator;
  bool create_if_missing            = false;
  bool error_if_exists              = false;
  bool paranoid_checks              = false;
  Env* env;
  Logger* info_log                  = nullptr;
  size_t write_buffer_size          = 4 * 1024 * 1024;
  int max_open_files                = 1000;
  Cache* block_cache                = nullptr;
  size_t block_size                 = 4 * 1024;
  int block_restart_interval        = 16;
  size_t max_file_size              = 2 * 1024 * 1024;
  CompressionType compression       = kSnappyCompression;
  int zstd_compression_level        = 1;
  bool reuse_logs                   = false;
  const FilterPolicy* filter_policy = nullptr;
};
```

- `comparator`
  - Purpose: defines the sort order of keys in the table.
  - Default: bytewise lexicographic ordering
  - Note: **Users can provide a custom comparator to define the order of keys. It must be consistent with the comparator used when the database was previously opened; otherwise, the ordering will be inconsistent and data cannot be read correctly**.
- `create_if_missing`
  - Purpose: whether to automatically create the corresponding database files if the database does not exist
  - Default: `false`
  - Note: **When opening a database, if the database does not exist and this is set to true, LevelDB automatically creates a new database. If it is set to false and the database does not exist, an error is returned**.
- `error_if_exists`
  - Purpose: whether to return an error if the database files already exist
  - Default: `false`
  - Note: **When creating a new database, setting this to true prevents overwriting existing data if the database already exists**.
- `paranoid_checks`
  - Purpose: whether to enable strict data checking
  - Default: `false`
  - Note: **When enabled, stricter checks are performed during database operations. If data corruption is detected, the operation is terminated early. Suitable for scenarios with very high data integrity requirements**.
- `env`
  - Purpose: used to interact with the environment, such as reading/writing files, scheduling background tasks, and so on. 
  - Default: `Env::Default()`. 
  - Note: a custom env can be provided, for example to simulate different operating environments or customize file system behavior.
- `info_log`
  - Purpose: used to record the database's internal progress and error information
  - Default: `nullptr`, which means log messages are written to a file in the database's directory
  - Note: if the user wants log messages recorded at a specific location, a custom logger object can be provided
- `write_buffer_size`
  - Purpose: the amount of data built up in memory before it is converted into a sorted on-disk file
  - Default: `4MB`
  - Note: **Increasing this value can improve write performance, especially for bulk writes. However, a larger write_buffer_size also leads to longer recovery time when the database is opened**
- `max_open_files`
  - Purpose: the maximum number of files the database can keep open
  - Default: 1000
  - Note: a larger value reduces the overhead of frequently opening and closing files and is suitable for databases with large working sets. Each SSTable file requires one file handle, so a larger working set requires more open files
- `block_cache`
  - Purpose: provides a cache for blocks. If it is `nullptr`, LevelDB automatically creates and uses an internal 8MB cache
  - Default: `nullptr`(`8MB`)
  - Note: users can provide a custom block cache object to optimize read performance and reduce the number of disk reads
- `block_size`
  - Purpose: the approximate size of user data packed into each block; a block is the basic unit read from disk
  - Default: `4KB`
  - Note: larger blocks reduce the amount of metadata stored, but may increase the overhead of reading unnecessary data (read amplification). Smaller blocks suit random reads, while larger blocks suit sequential reads
- `block_restart_interval`
  - Purpose: used for delta encoding of keys; how many keys are encoded between restart points
  - Default: `16`
  - Note: **In most cases there is no need to modify this parameter. This value affects the efficiency of key storage and retrieval**
- `max_file_size`
  - Purpose: the maximum number of bytes written to a single file before switching to a new file
  - Default: `2MB`
  - Note: when initially loading large amounts of data, increasing this value reduces the number of files, but leads to longer compaction times, which affects performance
- `compression`
  - Purpose: specifies the compression algorithm to use; blocks may be compressed before being stored to files
  - Default: `kSnappyCompression`
  - Note: Snappy is a lightweight and fast compression algorithm suitable for most scenarios. If a higher compression ratio is needed, other algorithms can be chosen, but some performance may be sacrificed. If compression is not desired, choose kNoCompression
- `zstd_compression_level`
  - Purpose: specifies the compression level for the `Zstandard` compression algorithm
  - Default: 1
  - Note: Zstandard supports different compression levels; higher levels provide better compression ratios, but compression and decompression become slower. This parameter is used for tuning when Zstandard compression is enabled
- `reuse_logs`
  - Purpose: whether to reuse the existing `MANIFEST` and log files when opening the database.
  - Default: `false`
  - Note: **When set to true, the database reuses the existing log files on open, which can significantly speed up opening, but this feature is experimental**.
- `filter_policy`
  - Purpose: uses the specified filter policy to reduce disk reads. Many applications benefit from the result of `NewBloomFilterPolicy()`
  - Default: `nullptr`
  - Note: a Bloom filter can be used to reduce unnecessary disk reads and is suitable for most scenarios. A Bloom filter can efficiently determine whether a key exists in an SSTable, thereby avoiding reads for keys that do not exist

---  

### ReadOptions

```cpp
// Options that control read operations
struct LEVELDB_EXPORT ReadOptions {
  bool verify_checksums     = false;
  bool fill_cache           = true;
  const Snapshot* snapshot  = nullptr;
};
```

- `verify_checksums`
  - Purpose: whether to verify the checksums of data read from the underlying storage
  - Default: `false`
  - Note: when set to true, every piece of data read is checksum-verified to ensure it has not been corrupted during storage and transfer. Enabling this option strengthens data integrity guarantees, but increases the overhead of read operations.
- `fill_cache`
  - Purpose: whether data read should be cached in memory (the block cache)
  - Default: `true`
  - Note: when set to true, data read is placed into the block cache, so subsequent reads of the same data can be served directly from memory, improving read speed. If set to false, data read is not cached, which suits scenarios with infrequently accessed data or large one-time reads, such as bulk scan operations.
- `snapshot`
  - Purpose: specifies the snapshot to use for the read operation.
  - Default: `nullptr` (implicitly uses a snapshot of the database state at the start of the read operation)
  - Note: a snapshot is a static view of the database at a particular moment, allowing read operations in scenarios with high consistency requirements. Even if writes occur in the database during the read, the data read is still the data as of the snapshot moment. If no snapshot is specified (snapshot = nullptr), the read operation by default uses the current state of the database at the start of the operation

---  

### WriteOptions

```cpp
// Options that control write operations
struct LEVELDB_EXPORT WriteOptions {
  WriteOptions() = default;
  bool sync      = false;
};
```

- `sync`
  - Purpose: determines whether a write operation waits until the operating system's buffer cache has been flushed to disk
  - Default: `false`
  - Note:
    - sync = true: after the write completes, the data must be synchronously flushed to disk. This uses fsync() or a similar system call to ensure the data has truly been written to disk rather than merely sitting in the operating system's in-memory cache. This makes writes slower, but provides a stronger durability guarantee. If the machine or operating system crashes, the data is not lost.
    - sync = false: the write is not immediately synced to disk; the data is temporarily held in the operating system's cache. This makes writes faster, but if the machine crashes (for example, a power failure or an OS crash), the cached data may be lost. However, if only the process crashes (the machine does not restart), the data can still be recovered from the OS cache.

## DBImpl::DBImpl

This section only introduces `DBImpl` partially; it does not analyze every implementation of `DBImpl`. The goal is to understand what is necessary and ignore the other distractions.

```cpp
DBImpl::DBImpl(const Options& raw_options, const std::string& dbname)
    : env_(raw_options.env),
      internal_comparator_(raw_options.comparator),
      internal_filter_policy_(raw_options.filter_policy),
      options_(SanitizeOptions(
        dbname, &internal_comparator_, &internal_filter_policy_, raw_options)),
      owns_info_log_(options_.info_log != raw_options.info_log),
      owns_cache_(options_.block_cache != raw_options.block_cache),
      dbname_(dbname),
      table_cache_(new TableCache(dbname_, options_, TableCacheSize(options_))),
      db_lock_(nullptr),
      shutting_down_(false),
      background_work_finished_signal_(&mutex_),
      mem_(nullptr),
      imm_(nullptr),
      has_imm_(false),
      logfile_(nullptr),
      logfile_number_(0),
      log_(nullptr),
      seed_(0),
      tmp_batch_(new WriteBatch),
      background_compaction_scheduled_(false),
      manual_compaction_(nullptr),
      versions_(
        new VersionSet(dbname_, &options_, table_cache_, &internal_comparator_)) {}
```

In the constructor above, fields that are taken directly from `Options` and assigned as-is need no further explanation; here we focus on the meaning and purpose of the other fields.

The `SanitizeOptions` function validates and adjusts the user-provided `raw_options` to ensure that database operations do not run into problems caused by unreasonable parameters. `SanitizeOptions` adjusts the fields of the options according to default values and limits.

```cpp
Options SanitizeOptions(const std::string& dbname,
                        const InternalKeyComparator* icmp,
                        const InternalFilterPolicy* ipolicy,
                        const Options& src) {
  Options result = src;
  result.comparator = icmp;
  result.filter_policy = (src.filter_policy != nullptr) ? ipolicy : nullptr;
}
```

First, `SanitizeOptions` creates a copy `result` of the `src options`, which is validated and adjusted into reasonable options before being returned at the end. It then assigns the internal comparator `icmp` to `result.comparator`, ensuring that the internal comparator is used rather than a user-defined comparator.

If the user provides a filter_policy in src, the internal ipolicy is assigned to result.filter_policy; otherwise, it is set to nullptr. This guarantees that if the user does not specify a filter policy, the system will not use a filter.

```cpp
template <class T, class V>
static void ClipToRange(T* ptr, V minvalue, V maxvalue) {
  if (static_cast<V>(*ptr) > maxvalue) *ptr = maxvalue;
  if (static_cast<V>(*ptr) < minvalue) *ptr = minvalue;
}

ClipToRange(&result.max_open_files, 64 + kNumNonTableCacheFiles, 50000);
ClipToRange(&result.write_buffer_size, 64 << 10, 1 << 30);
ClipToRange(&result.max_file_size, 1 << 20, 1 << 30);
ClipToRange(&result.block_size, 1 << 10, 4 << 20);
```

The `ClipToRange` function ensures that the value pointed to by ptr is clamped to the range $[minvalue, maxvalue]$. If the value of ptr falls outside this range, the function clips it to the boundary value of the range. Therefore, the values of the `max_open_files`, `write_buffer_size`, `max_file_size`, and `block_size` options are checked here to see whether they lie within reasonable ranges, and are clipped to appropriate values if not.

```cpp
if (result.info_log == nullptr) {
    // Open a log file in the same directory as the db
    src.env->CreateDir(dbname);  // In case it does not exist
    src.env->RenameFile(InfoLogFileName(dbname), OldInfoLogFileName(dbname));
    Status s = src.env->NewLogger(InfoLogFileName(dbname), &result.info_log);
    if (!s.ok()) {
      // No place suitable for logging
      result.info_log = nullptr;
    }
}
```

If info_log is nullptr (the user did not specify a logger), a log file directory is created in the database path. If the directory does not exist, it is created. At the same time, the current log file is renamed to the "old log file". InfoLogFileName(dbname) returns the log file name, and OldInfoLogFileName(dbname) returns the old log file name. Doing this avoids overwriting the existing log.

```bash
# 实际逻辑为：
# 如果目前有一个日志文件为`dbname/LOG`，那么首先先重命名该文件
mv dbname/LOG dbname/LOG.old
# 然后再将logger指向新的`dbname/LOG`，这样就不会覆盖原有的`dbname/LOG`
```

A new Logger is created and pointed at the new log file. The NewLogger function is responsible for creating and opening the log file for writing. If creating the log file fails (i.e., s.ok() returns false), info_log is set to nullptr, indicating that no logger could be created.

```cpp
if (result.block_cache == nullptr) {
    result.block_cache = NewLRUCache(8 << 20);
}
return result;
```

If the user does not provide a cache, a new `LRUCache` object of size $8MB(8 << 20)$ is created. `LRUCache` is used to cache database blocks to reduce disk reads and improve performance.

Finally, the validated options `result` are returned. The following explains the meaning of the members initialized in `DBImpl:DBImpl`:

- `owns_info_log_`
  - owns_info_log_ marks whether the current object owns the info_log_ logger object. If options_.info_log differs from the user-provided raw_options.info_log, it means the database itself owns and is responsible for managing the log file
- `owns_cache_`
  - owns_cache_ marks whether the database owns the block_cache block cache. If options_.block_cache differs from the user-provided raw_options.block_cache, it means the database owns its own block cache and is responsible for managing it
- `table_cache_`
  - table_cache_ is the caching system used to cache database tables (i.e., SSTables). It is created based on the database path dbname_ and the options options_, and internally manages the metadata of SSTable files
- `db_lock_`
  - db_lock_ is used for file locking to prevent multiple database instances from opening the same database path at the same time. It is nullptr at initialization; the file locking operation is performed later when the database is opened
- `shutting_down_`
  - shutting_down_ is a flag indicating whether the database is in the process of shutting down. When true, it means background tasks and write operations need to be terminated.
- `background_work_finished_signal_`
  - background_work_finished_signal_ is a condition variable used to notify the main thread or other waiting threads after a background thread finishes its work (such as compaction). It is associated with mutex_ to guarantee multi-threaded synchronization.
- `mem_`
  - mem_ is the current in-memory MemTable, used to store recent write operations that have not yet been persisted to disk. It is nullptr when the database starts and is allocated later
- `imm_`
  - imm_ is the immutable MemTable: when a MemTable reaches its size limit, it is marked as immutable and waits to be written to disk. It is nullptr at initialization
- `has_imm_`
  - has_imm_ marks whether an immutable MemTable exists. When true, it means imm_ needs to be persisted to disk
- `logfile_`
  - logfile_ is the current log file, used to record write operations (Write-Ahead Logging). Each MemTable has a corresponding log file. It is nullptr at initialization
- `logfile_number_`
  - logfile_number_ is the number of the log file, used to identify the current log file. It is initialized to 0.
- `log_`
  - log_ is the log writer, used to serialize write operations and write them to the log file. It is nullptr at initialization and is created later.
- `seed_`
  - seed_ is the seed for random number generation, mainly used for certain randomized operations, such as the delayed handling of compactions.
- `tmp_batch_`
  - tmp_batch_ is a temporary write batch object that helps merge multiple write operations to improve efficiency.
- `background_compaction_scheduled_`
  - background_compaction_scheduled_ is a flag indicating whether a background compaction task has been scheduled. If true, a compaction task is in progress or has already been planned
- `manual_compaction_`
  - manual_compaction_ is used for manually triggered compaction tasks. It is nullptr at initialization, meaning there is currently no manual compaction task
- `versions_`
  - versions_ manages the database's version information and metadata. VersionSet is responsible for maintaining the list of SSTable files and the strategy for compaction operations.
