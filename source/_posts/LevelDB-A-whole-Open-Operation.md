---
title: 'LevelDB: A whole Open Operation'
mathjax: true
date: 2024-09-16 22:17:21
tags: [leveldb, option]
categories: [leveldb]
---

# LevelDB: A whole Open Operation  

*我在最近接触了分布式存储计算这一个方向，因此想从leveldb作为一个最初的学习项目；起初，我是通过[硬核课堂 LevelDB源码分析](https://hardcore.feishu.cn/mindnotes/bmncnzpUmXNQruVGOwRwisHyxoh)这一飞书文档学习，但是这个文档有些学习顺序我个人不是很习惯，因此打算分模块去将整个LevelDB的整个源码细节*。

*首先第一个模块，便是`DB::Open`这一操作*。我们需要分析`Open`的操作，就首先需要从一个宏观的角度分析`Open`会做出什么操作。

**`DB::Open`是用于打开一个数据库的核心函数。它的主要任务是`初始化数据库`、`加载数据库元数据`、恢复/修复数据库数据`并`确保数据库处于可用状态`**。

我们首先从宏观角度来观察`DB::Open`的实现具体做了些什么：

- 第一步：初始化

``` cc
Status DB::Open(
    const Options& options, 
    const std::string& dbname, 
    DB** dbptr) {
    *dbptr = nullptr;
}
```

`Open`函数会在一开始就将想要返回的`db`句柄设置为`nullptr`这是为了确保**函数执行过程中，一旦出现任何问题，`dbptr`就会保持为`nullptr`，表示数据库打开失败**。

- 第二步：创建`DBImpl`数据库实例

``` cc
DBImpl* impl = new DBImpl(options, dbname);
impl->mutex_.Lock();
```

`DBImpl`是`DB`的内部接口，`DBImpl`是实际上的操作接口，这一点会在后面详细介绍。然后我们需要保证数据库的操作在多线程环境下是安全的，因此对`DBImpl::mutex_`进行上锁。

- 第三步：恢复操作的初始化

``` cc
VersionEdit edit;
bool save_manifest = false;
Status s = impl->Recover(&edit, &save_manifest);
```

在`LevelDB`中，`VersionEdit`的**主要作用是记录数据库版本的更改。具体来说，它用于描述数据库的元数据变更，如文件的添加、删除以及日志编号的更新。这些更改会被写入 `MANIFEST` 文件中，以确保数据库的状态在系统重启或恢复时能够一致且可靠地重建**。

`save_manifest`用于标识是否需要更新 `MANIFEST` 文件，而`Recover`函数负责处理数据库的恢复，**确保数据库处于一致的状态**，并根据选项`create_if_missing`和`error_if_exists`来决定是否创建或报告错误。

- 第四步：创建MemTable和对应的日志文件

``` cc
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

在`LevelDB`中，`MemTable`是一个核心的数据结构，**它用于暂时存储写入操作的数据，并在合适的时机将其写入磁盘。`MemTable`是一个内存中的`跳表(skip list)`，支持高效的插入、查询、和删除操作**。

- **当数据被写入 LevelDB 时，首先会写入到 MemTable 中，而不是直接写入磁盘。这是为了避免频繁的磁盘 I/O，提升写入性能**。
- **写入到 MemTable 的数据也会被同时记录在一个日志文件（WAL，Write-Ahead Log）中，以确保在崩溃时可以通过日志文件恢复未写入磁盘的数据**.

如果在第三步时的`Recover`操作正常进行，并且此时需要打开的数据库中没有相应的`MemTable`，那么就应该创建新的日志文件和一块新的`MemTable`用于记录操作和存储内存中的数据，稍后通过`MemTable`写入到磁盘中。

- 第五步：保存`MANIFEST`文件

``` cc
if (s.ok() && save_manifest) {
  edit.SetPrevLogNumber(0);
  edit.SetLogNumber(impl->logfile_number_);
  s = impl->versions_->LogAndApply(&edit, &impl->mutex_);
}
```

如果恢复过程中需要保存 `MANIFEST` 文件，函数会更新新的日志文件编号，并通过 `LogAndApply` 应用这些更改。

- 第六步：清理与压缩

``` cc
if (s.ok()) {
  impl->RemoveObsoleteFiles();
  impl->MaybeScheduleCompaction();
}
```

如果一切仍然成功，函数将删除无用的文件（例如旧日志文件），并根据需要安排一次压缩操作。压缩操作可以减少数据库大小并提升性能。

- 第七步：返回DB句柄

``` cc
impl->mutex_.Unlock();
if (s.ok()) {
  assert(impl->mem_ != nullptr);
  *dbptr = impl;
} else {
  delete impl;
}
return s;
```

在这里，我们从宏观角度的视角了解了`DB::Open`的操作，以及其对应的作用，现在我们需要更细节的将整个`Open`的操作进行解构。

## Options  

`Options`主要**用于配置和控制数据库的行为，包括读写性能、资源使用、压缩策略等方面。`Options`类包含多种配置选项，允许用户在创建和使用数据库时根据具体需求进行定制**。

对于`LevelDB::Options`而言，在整个数据库中有三种类型的`Options`：

- `Options`: 用于控制数据库级别的全局配置
- `ReadOptions`: 用于控制数据库读取操作的行为
- `WriteOptions`: 用于控制数据库写入操作的行为

### Options

首先我们先给出`Options`的详细定义，实际上`Options`是一个开放式的结构体，其中内部的所有参数都是公开可修改的。

``` cc
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
  - 作用：用于定义表中键的排序方式。
  - 默认值：按字节进行字典序排序
  - 限制：**用户可以提供自定义的比较器，用于定义键的顺序。必须确保与以前打开数据库时使用的比较器一致，否则会出现排序不一致的问题，导致数据无法正确读取**。
- `create_if_missing`
  - 作用：如果数据库文件不存在，是否自动创建对应的数据库文件
  - 默认值：`false`
  - 限制：**当打开数据库时，如果该数据库不存在，设置为 true 时，LevelDB 会自动创建一个新数据库。如果设置为 false 并且数据库不存在，则返回错误**。
- `error_if_exists`
  - 作用：如果数据库文件已经存在，是否返回错误
  - 默认值：`false`
  - 限制：**当创建新数据库时，如果该数据库已经存在，设置为 true 可避免覆盖现有数据**。
- `paranoid_checks`
  - 作用：是否开启严格的数据检查
  - 默认值：`false`
  - 限制：**开启后，数据库操作过程中会进行更严格的检查。如果发现数据损坏，操作会提前终止。适合在对数据完整性要求非常高的场景下使用**。
- `env`
  - 作用: 用于与环境交互，例如读取/写入文件、调度后台任务等。 
  - 默认值：`Env::Default()`。 
  - 限制：可自定义 env，例如用于模拟不同的操作环境或自定义文件系统行为。
- `info_log`
  - 作用：用于记录数据库内部的进度和错误信息
  - 默认值：`nullptr`，表示日志信息会被写入数据库所在目录中的文件
  - 限制：如果用户希望将日志信息记录到指定位置，可以提供自定义的日志对象
- `write_buffer_size`
  - 作用：在内存中构建数据的大小，达到该值后会将其转换为排序的磁盘文件
  - 默认值：`4MB`
  - 限制：**增大此值可以提升写入性能，尤其是批量写入时。不过，较大的 write_buffer_size 也会导致在数据库打开时恢复时间更长**
- `max_open_files`
  - 作用：数据库可以打开的最大文件数
  - 默认值：1000
  - 限制：设置更大的值可以减少文件频繁打开和关闭的开销，适用于工作集较大的数据库。每个 SSTable 文件需要一个文件句柄，因此较大的工作集需要较多的文件打开数
- `block_cache`
  - 作用：为块提供缓存。如果为 `nullptr`，则 LevelDB 会自动创建并使用一个 8MB 的内部缓存
  - 默认值: `nullptr`(`8MB`)
  - 限制：用户可以自定义块缓存对象，以优化读取性能，减少磁盘读取次数
- `block_size`
  - 作用：每个块中存放的用户数据的近似大小，块是从磁盘读取的基本单位
  - 默认值: `4KB`
  - 限制：较大的块可以减少元数据的存储量，但可能增加读取非必要数据的开销（读放大）。较小的块适合随机读取，较大的块则适合顺序读取
- `block_restart_interval`
  - 作用：用于键的增量编码，每隔多少个键进行一次重启点的记录
  - 默认值：`16`
  - 限制：**大多数情况下无需修改此参数。该值影响键的存储和读取的效率**
- `max_file_size`
  - 作用：写入到一个文件中的最大字节数，达到该值后会切换到新文件
  - 默认值：`2MB`
  - 限制：在初次加载大量数据时，增大此值可以减少文件数，但会导致更长的压缩时间，从而影响性能
- `compression`
  - 作用：指定使用的压缩算法，块可能会在存储到文件之前进行压缩
  - 默认值：`kSnappyCompression`
  - 限制：Snappy 是轻量且快速的压缩算法，适合大多数场景。如果需要更高的压缩率，可以选择其他算法，但可能会牺牲一些性能。如果不希望压缩，可以选择 kNoCompression
- `zstd_compression_level`
  - 作用：为 `Zstandard` 压缩算法指定压缩级别
  - 默认值：1
  - 限制：Zstandard 支持不同的压缩级别，较高的压缩级别提供更好的压缩率，但压缩和解压缩速度会变慢。该参数适用于使用 Zstandard 压缩时的调优
- `reuse_logs`
  - 作用：是否在打开数据库时重用现有的 `MANIFEST` 和日志文件。
  - 默认值：`false`
  - 限制：**设置为 true 时，数据库在打开时会重用现有的日志文件，可能会显著加快打开速度，但这个特性是实验性的**。
- `filter_policy`
  - 作用：使用指定的过滤策略来减少磁盘读取。很多应用将从 `NewBloomFilterPolicy()` 的结果中受益
  - 默认值：`nullptr`
  - 限制：可以使用布隆过滤器来减少不必要的磁盘读取，适用于大多数场景。布隆过滤器能有效判断某个键是否存在于 SSTable 中，从而避免读取不存在的键

---  

### ReadOptions

``` cc
// Options that control read operations
struct LEVELDB_EXPORT ReadOptions {
  bool verify_checksums     = false;
  bool fill_cache           = true;
  const Snapshot* snapshot  = nullptr;
};
```

- `verify_checksums`
  - 作用：是否验证从底层存储读取的数据的校验和（checksum）
  - 默认值：`false`
  - 限制：当设置为 true 时，每次读取数据时都会对其进行校验和验证，以确保数据在存储和传输过程中没有被损坏。启用此选项可以增强数据完整性保证，但会增加读取操作的开销。
- `fill_cache`
  - 作用：读取的数据是否应缓存到内存中（块缓存）
  - 默认值：`true`
  - 限制：当设置为 true 时，读取的数据会被放入块缓存中，后续读取相同的数据可以直接从内存中获取，从而提高读取速度。如果设置为 false，读取的数据不会被缓存，适合于不常访问或一次性读取的大数据块场景，例如批量扫描操作。
- `snapshot`
  - 作用：用于指定读取操作的快照。
  - 默认值：`nullptr`(隐式使用读取操作开始时的数据库状态快照)
  - 限制: 快照是一种数据库在某一时刻的静态视图，允许在一致性要求较高的场景中进行读取操作。即使在读取期间数据库发生了写操作，读取的数据也依然是快照时刻的数据。如果不指定快照（snapshot = nullptr），则默认读取操作会使用该操作开始时数据库的当前状态

---  

### WriteOptions

``` cc
// Options that control write operations
struct LEVELDB_EXPORT WriteOptions {
  WriteOptions() = default;
  bool sync      = false;
};
```

- `sync`
  - 作用：决定写操作在操作系统的缓冲区缓存被刷新到磁盘之前，是否需要等待
  - 默认值：`false`
  - 限制：
    - sync = true：表示写操作完成后，必须将数据同步刷新到磁盘。这通过调用 fsync() 或类似的系统调用来确保数据已真正写入磁盘，而不是仅仅保存在操作系统的内存缓存中。这种方式会使写操作变得较慢，但提供了更强的持久性保证。如果机器或操作系统崩溃，数据不会丢失。
    - sync = false：表示写操作不会立即同步到磁盘，数据会暂时保存在操作系统的缓存中。这会使写操作更快，但如果机器崩溃（例如断电或操作系统崩溃），缓存中的数据可能丢失。但如果只是进程崩溃（机器没有重启），数据依然可以从操作系统缓存中恢复。

## DBImpl::DBImpl

这里只会局部的介绍`DBImpl`，并不会对`DBImpl`的所有实现进行分析，做到了解必要，忽略其他的干扰项。

``` cc
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

在构造上述中，对于从`Options`中取出并直接赋值的字段不做其他解释，这里重点介绍其他字段的含义和作用。

`SanitizeOptions`函数用于对用户提供的`raw_options`进行合理性验证和修改，确保数据库操作不会因为不合理的参数导致问题。`SanitizeOptions`函数根据默认值和限制，对选项中的字段进行调整。

``` cc
Options SanitizeOptions(const std::string& dbname,
                        const InternalKeyComparator* icmp,
                        const InternalFilterPolicy* ipolicy,
                        const Options& src) {
  Options result = src;
  result.comparator = icmp;
  result.filter_policy = (src.filter_policy != nullptr) ? ipolicy : nullptr;
}
```

首先`SanitizeOptions`会创建一个`src options`的副本`result`用于验证和修改为合理的选项，并在最后返回。然后将将内部的比较器 `icmp` 赋值给 `result.comparator`，确保使用内部的比较器，而不是用户自定义的 comparator。

如果用户在 src 中提供了 filter_policy，则将内部的 ipolicy 赋值给 result.filter_policy。否则，设为 nullptr。这保证了如果用户没有指定过滤策略，系统不会使用过滤器。

``` cc
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

函数`ClipToRange`确保某个指针指向的值 ptr 被限制在 $[minvalue, maxvalue]$ 范围内。如果 ptr 的值超出这个范围，函数将其裁剪到范围的边界值。因此，这里会对`max_open_files`、`write_buffer_size`、`max_file_size`和`block_size`选项的值进行判断是否位于合理的范围内，如果不在则进行裁剪为合适的值。

``` cc
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

如果 info_log 为 nullptr（用户没有指定日志记录器），则在数据库路径中创建日志文件目录。如果目录不存在，则创建该目录。同时将将当前的日志文件重命名为 "旧的日志文件"。InfoLogFileName(dbname) 获取日志文件名，OldInfoLogFileName(dbname) 获取旧日志文件名。这样做可以避免覆盖现有日志。

``` bash
# 实际逻辑为：
# 如果目前有一个日志文件为`dbname/LOG`，那么首先先重命名该文件
mv dbname/LOG dbname/LOG.old
# 然后再将logger指向新的`dbname/LOG`，这样就不会覆盖原有的`dbname/LOG`
```

创建新的日志记录器 Logger，并将其指向新的日志文件。NewLogger 函数负责创建并打开日志文件用于写入。如果创建日志文件失败（即 s.ok() 返回 false），将 info_log 置为 nullptr，表示无法创建日志记录器。

``` cc
if (result.block_cache == nullptr) {
    result.block_cache = NewLRUCache(8 << 20);
}
return result;
```

如果用户没有提供缓存，则创建一个新的 `LRUCache` 对象，大小为 $8MB(8 << 20)$。`LRUCache`用于缓存数据库的块，以减少磁盘读取，提高性能。

最终返回验证完合理性的选项`result`。以下是对`DBImpl:DBImpl`初始化的成员含义做出解释：

- `owns_info_log_`
  - owns_info_log_ 用于标记当前对象是否拥有 info_log_ 日志文件对象。如果 options_.info_log 与用户提供的 raw_options.info_log 不同，则表示数据库自己拥有并负责管理日志文件
- `owns_cache_`
  - owns_cache_ 用于标记数据库是否拥有 block_cache 块缓存。如果 options_.block_cache 和用户传入的 raw_options.block_cache 不同，则表示数据库拥有自己的块缓存并负责其管理
- `table_cache_`
  - table_cache_ 是用于缓存数据库表（即 SSTable）的缓存系统。它基于数据库路径 dbname_ 和选项 options_ 创建，内部管理 SSTable 文件的元数据信息
- `db_lock_`
  - db_lock_ 用于文件锁定，防止多个数据库实例同时打开同一个数据库路径。初始化时为 nullptr，稍后会在打开数据库时进行文件锁定操作
- `shutting_down_`
  - shutting_down_ 是一个标志，用于指示数据库是否正在关闭操作。当 true 时，表示后台任务和写操作需要终止。
- `background_work_finished_signal_`
  - background_work_finished_signal_ 是一个条件变量，用于在后台线程完成工作（如压缩）后，通知主线程或其他等待的线程。它与 mutex_ 关联，保证多线程同步。
- `mem_`
  - mem_ 是当前内存中的 MemTable，用于存储最近的写入操作，尚未持久化到磁盘。在数据库启动时为 nullptr，后续会分配
- `imm_`
  - imm_ 是不可变的 MemTable，即当一个 MemTable 达到大小限制后，它被标记为不可变，等待写入到磁盘。初始化时为 nullptr
- `has_imm_`
  - has_imm_ 用于标记是否存在不可变的 MemTable。当为 true 时，表示 imm_ 需要被持久化到磁盘
- `logfile_`
  - logfile_ 是当前日志文件，用于记录写入操作（Write-Ahead Logging）。每个 MemTable 都有一个相对应的日志文件，初始化时为 nullptr
- `logfile_number_`
  - logfile_number_ 是日志文件的编号，用于标识当前的日志文件。初始化时为 0。
- `log_`
  - log_ 是日志写入器，用于将写操作序列化并写入日志文件。初始化时为 nullptr，稍后会创建。
- `seed_`
  - seed_ 是随机数生成的种子，主要用于某些随机化操作，例如压缩的延时处理。
- `tmp_batch_`
  - tmp_batch_ 是一个临时的批量写入对象，帮助合并多个写入操作，以提高效率。
- `background_compaction_scheduled_`
  - background_compaction_scheduled_ 是一个标志，指示是否已经安排了后台压缩任务。若为 true，表示压缩任务正在进行或已经计划好
- `manual_compaction_`
  - manual_compaction_ 用于手动触发的压缩任务。初始化时为 nullptr，表示当前没有手动压缩任务
- `versions_`
  - versions_ 管理数据库的版本信息和元数据。VersionSet 负责维护 SSTable 文件的列表以及压缩操作的策略。

