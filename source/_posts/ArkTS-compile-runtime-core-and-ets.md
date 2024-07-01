---
title: 'ArkTS: compile runtime_core and ets_*'
mathjax: true
date: 2024-07-01 15:52:20
tags: [arkts, ospp]
categories: [arkts]
---

# ArkTS Compile

在这一节中，我会介绍`ArkTS`的四大组件以及如何编译并成功运行`ArkTS`的前端和运行时。

## ArkTS Components

方舟编译器(ArkCompiler)是为支持多种编程语言、多种芯片平台的联合编译、运行而设计的统一编译运行时平台。它支持包括动态类型和静态类型语言在内的多种编程语言，如JS、TS、ArkTS；它是支撑OpenHarmony系统成为打通手机、PC、平板、电视、车机和智能穿戴等多种设备的操作系统的编译运行时底座。

从结构上看，ArkCompiler主要分成两个部分：编译工具链与运行时。

![编译工具链架构](https://gitee.com/openharmony/docs/raw/master/zh-cn/readme/figures/zh-cn_image_ark_frontend.png)

ArkCompiler的编译工具链以ArkTS/TS/JS源码作为输入，将其编译生成为abc(ArkCompiler Bytecode，即方舟字节码)文件。其主要是通过在编译中产生的二进制程序`es2abc`进行工作：

``` bash
es2abc hello.js
```

![运行时架构](https://gitee.com/openharmony/docs/raw/master/zh-cn/readme/figures/zh-cn_image_ark-ts-arch.png)

ArkCompiler运行时直接运行字节码文件，实现对应语言规范的语义逻辑。

主要由四个子系统组成：

- Core Subsystem 
  - Core Subsystem主要由与语言无关的基础运行库组成，包括承载字节码的File组件、支持Debugger的Tooling组件、负责适配系统调用的Base库组件等。 
- Execution Subsystem 
  - Execution Subsystem包含执行字节码的解释器、快速路径内联缓存、以及抓取运行时信息的Profiler。 
- Compiler Subsystem 
  - Compiler Subsystem包含Stub编译器、基于IR的编译优化框架和代码生成器。 
- Runtime subsystem 
  - Runtime Subsystem包含了ArkTS/TS/JS运行相关的模块。 
  - 内存管理：对象分配器与垃圾回收器(并发标记和部分内存压缩的CMS-GC和Partial-Compressing-GC)
    - 分析工具：DFX工具、cpu和heap的profiling工具 
    - 并发管理：actor并发模型中的abc文件管理器 
    - 标准库：Ecmascript规范定义的标准库、高效的container容器库与对象模型 
    - 其他：异步工作队列、TypeScript类型加载、跟C++交互的JSNAPI接口等。

在本次任务中，我们着重关注`Compiler Subsystem`中的`stub`和`assember`。以下给出了具体的一个工作目录结构：

``` bash
/arkcompiler
├── ets_runtime       # ArkTS运行时组件
    ├── ecmascript
        ├── compiler  # Assember解析目录
        └── stubs     # stubs
├── runtime_core      # 运行时公共组件
├── ets_frontend      # ArkTS语言的前端工具
└── toolchain         # ArkTS工具链
```

## Compile ETS

本次编译过程中的项目组织结构为：

``` bash
├── arkcompiler
│         ├── ets_frontend
│         ├── ets_runtime
│         ├── runtime_core
│         └── toolchain
├── ark.py -> arkcompiler/toolchain/build/compile_script/ark.py
├── build
│         ├── build_scripts
│         ├── config
│         ├── core
│         ├── docs
│         ├── ...
│         ├── gn_helpers.py
│         ├── ohos_var.gni
│         ├── prebuilts_download_config.json
│         ├── prebuilts_download.py
│         ├── prebuilts_download.sh
│         └── zip.py
├── developtools
├── download_packages
├── kernel
├── kernel_linux_patches -> kernel/linux/patches/
├── out
│         ├── install
│         ├── lib
│         ├── ... 
│         ├── ohos-riscv64
│         ├── ohos-riscv64-install
│         ├── riscv64.release
│         └── x64.release
├── packages
├── prebuilts
├── README.md
├── third_party
└── toolchain
    ├── lldb-mi
    └── llvm-project
```

### Dependency && Compile

在正式开始编译之前，我们首先需要解决依赖配置。目前，我所使用的环境为`Ubuntu 22.04 LTS`发行版，

``` bash 
sudo apt-get install git-lfs git bison flex gnupg build-essential zip curl zlib1g-dev gcc-multilib g++-multilib libc6-dev-i386 lib32ncurses-dev x11proto-core-dev libx11-dev libc++1 lib32z1-dev ccache libgl1-mesa-dev libxml2-utils xsltproc unzip m4 libtinfo5 bc npm genext2fs liblz4-tool libssl-dev ruby openjdk-8-jre-headless gdb python3-pip libelf-dev libxcursor-dev libxrandr-dev libxinerama-dev
```

这里是参考了[方舟运行时使用指南](https://gitee.com/openharmony/arkcompiler_ets_runtime/blob/master/docs/README_zh.md)的依赖配置。

需要注意的是，在`Ubuntu18.04`或`Ubuntu20.04`时，可能还存在`python`(通常新式的系统都直接支持`python3`)。因此需要通过符号链接生成一个`python`可执行文件：

``` bash
ln -s python3 python
```

完成这一步后，我们需要下载一些额外的依赖，这一点可以通过项目中的下载脚本自动配置：

``` bash
toolchain/llvm-project/llvm-build/env_prepare.sh
arkcompiler/toolchain/build/prebuilts_download/prebuilts_download.sh
```

下载完毕后，就可以通过`build.py`进行自动化构建`ArkTS`编译所需要的`clang`，在此处，我们需要的`x64`和`riscv64`架构的构建：

``` bash
python3 ./toolchain/llvm-project/llvm-build/build.py \
	--no-build-arm \
	--no-build-aarch64 \
	--no-build-mipsel \
	--no-build windows
```

我当前的配置为`11th Gen Intel i5-11400H (8) @ 2.688GHz`，使用的虚拟机配置为八核16G内存，通常编译`clang`的时长在三个半小时左右。编译完成后，需要将产出的`clang`拷贝到`prebuilts`文件夹中：

``` bash
mv prebuilts/clang/ohos/linux-x86_64/llvm prebuilts/clang/ohos/linux-x86_64/llvm.origin 
cp -r out/install/linux-x86_64/clang-dev/ prebuilts/clang/ohos/linux-x86_64/llvm
```

为了构建在`riscv64`架构下适配的`ArkTS`，我们需要单独构建`riscv64`架构的`LLVM lib`：

``` bash
python3 toolchain/llvm-project/llvm-build/build-ohos-riscv64.py
```

执行`build-ohos-riscv64.py`通常需要半个小时左右，完成后，需要将`riscv64`架构的`LLVM lib`产出拷贝到`prebuilts`目录下：

``` bash
mkdir -p prebuilts/ark_tools/ark_js_prebuilts/llvm_prebuilts_riscv64/{build,llvm}
cp -r out/ohos-riscv64-install/include prebuilts/ark_tools/ark_js_prebuilts/llvm_prebuilts_riscv64/llvm/
cp -r out/ohos-riscv64/{include,lib} prebuilts/ark_tools/ark_js_prebuilts/llvm_prebuilts_riscv64/build/
```

这样，前期准备就完成了。现在，就可以开始执行`ark.py`脚本来编译对应架构下的`ets_*`工具链了。

编译`x86_64`的`ArkTS`前端、运行时：

``` bash
python3 ./arkcompiler/toolchain/build/compile_script/ark.py x64.release --verbose
```

编译`riscv64`的`ArkTS`前端、运行时：

``` bash
python3 ./arkcompiler/toolchain/build/compile_script/ark.py riscv64.release --verbose
```

**需要注意的是，在未修改的依赖项中**，`riscv64`**架构下编译不会对**`ets_frontend`**生效**。关于如何启用和修改`bug`，将在后面进行介绍。

然后你可以看到在`out`目录中的一个目录树结构：

``` bash
out/
├── install
├── ...
├── ohos-riscv64
├── ohos-riscv64-install
├── riscv64.release
└── x64.release
```

我们的目标生成文件位于：

``` bash
out/x64.release/
├── args.gn
├── arkcompiler
│         ├── ets_frontend
│         ├── ets_runtime
│         ├── runtime_core
│         └── toolchain
├── ...
├── gen
│         ├── arkcompiler
│         ├── isa
│         └── libpandabase
└── toolchain.ninja

out/riscv64.release/
├── args.gn
├── arkcompiler
│         ├── ets_runtime
│         ├── runtime_core
│         └── toolchain
├── ...
├── gen
│         ├── arkcompiler
│         ├── isa
│         └── libpandabase
└── toolchain.ninja
```

在这里我们也可以发现，`riscv64`架构下的`arkcompiler`目录中缺少了`ets_frontend`的生成。

## Dependency Detail && Fix

在上面我们发现，我们实际真正需要的`riscv64`的`ArkTS`工具链中，`ets_frontend`缺失，并且，关于`stub`实际上也没有真正编译。在这一小节中，我会对`arkcompiler`的`GN`依赖进行分析，然后逐步修复错误使得`ets_frontend`至少可用。

### Dependency Detail

我们是通过`ark.py`进行自动化构建的，现在对`ark.py`进行溯源，其原始目录位于:`arkcompiler/toolchain/build/compile_script/`，然后进入`ark.py`中进行解析：

``` python
def build_for_gn_target(self, out_path: str, gn_args: list, arg_list: list, log_file_name: str):
    # prepare log file
    build_log_path = os.path.join(out_path, log_file_name)
    str_to_build_log = "================================\nbuild_time: {0}\nbuild_target: {1}\n\n".format(
        str_of_time_now(), " ".join(arg_list))
    _write(build_log_path, str_to_build_log, "a")
    # gn command
    print("=== gn gen start ===")
    code = call_with_output(
        "{0} gen {1} --args=\"{2}\"".format(
            self.gn_binary_path, out_path, " ".join(gn_args).replace("\"", "\\\"")),
        build_log_path)
```

`build_for_gn_target`是主要构建函数，通过`gn`来进行构建，而`gn`会通过同级目录下的`.gn`文件进行配置：

``` bash
# The location of the build configuration file.
buildconfig = "//arkcompiler/toolchain/build/config/BUILDCONFIG.gn"

# The source root location.
root = "//arkcompiler/toolchain/build/core/gn"
```

我们暂时不需要关注`buildconfig`中的配置，我们主要的构建逻辑位于`root`中。并且，在开启`riscv64`后，我们需要首先知道这个信息：

``` bash
current_os=ohos,   current_cpu=riscv64
host_os=linux,      host_cpu=x64
target_os=ohos,    target_cpu=riscv64
```

首先`//root`设置了一个基本的默认构建逻辑，如果`host_os`不在`MacOS`上运行时，则对于`ArkTS`的四个组件都应该构建：

``` gn
group("default") {
  if (host_os != "mac") {
    deps = [
      ":ets_frontend",
      ":ets_runtime",
      ":runtime_core",
      ":toolchain",
    ]
  }
}
```

#### ets_runtime

然后，我们来看一看`ets_runtime`的构建逻辑：

``` gn
group("ets_runtime") {
  deps = [
    "$js_root:libark_jsruntime",
    "$js_root/ecmascript/js_vm:ark_js_vm",
    "$js_root/ecmascript/quick_fix:quick_fix",
  ]
  if ((target_os == "linux" && target_cpu == "x64") ||
      (target_cpu == "arm64" && target_os == "ohos")) {
    deps += [
      "$js_root/ecmascript/compiler:ark_aot_compiler",
      "$js_root/ecmascript/compiler:ark_stub_compiler",
      "$js_root/ecmascript/pgo_profiler/prof_dump:profdump",
    ]
  }
}
```

可以看见，在以来中，我们会生成两个可执行文件`ark_js_vm`和`quick_fix`。我们主要关注`ark_js_vm`的生成。在后面我们发现，这里只对于`x64`架构的`ets_runtime`提供了`ark_stub_compiler`提供了构建依赖，而对于`riscv64`并没有，因此，**我猜测，在后续实现时，我们需要在这里添加对于**`riscv64-ohos`**架构的支持**。

但是目前而言，因为`riscv stub`的实现暂时有些许问题，因此先忽视。在这里，`ets_runtime`都是能够正常编译的。

#### ets_frontend

现在，我们来看一看`ets_frontend`的构建逻辑：

``` gn
group("ets_frontend") {
  if ((target_os == "linux" && target_cpu == "x64") || target_os == "mingw") {
    deps = [
      "$ets_frontend_root/es2panda:es2panda",
      "$ets_frontend_root/merge_abc:merge_abc",
    ]
  }
}
```

在这里我们看到，`ets_frontend`只支持了`x64`的完整支持，因此需要做一定的修改：

``` gn
group("ets_frontend") {
  # FIX: Add the ohos-riscv64 ets_frontend dependency
  if ((target_os == "linux" && target_cpu == "x64") || 
      (target_os == "mingw") || 
      (target_os == "ohos" && target_cpu == "riscv64")) {
    deps = [
      "$ets_frontend_root/es2panda:es2panda",
      "$ets_frontend_root/merge_abc:merge_abc",
    ]
  }
}
```

修改后我们尝试运行：

``` bash
ERROR at //arkcompiler/toolchain/build/templates/cxx/cxx.gni:182:7: Script returned non-zero exit code.
      exec_script("$build_root/templates/cxx/external_deps_handler.py",
      ^----------
      
See //arkcompiler/toolchain/build/third_party_gn/protobuf/BUILD.gn:85:1: whence it was called.
ohos_static_library("protobuf_lite_static") {
^--------------------------------------------

See //arkcompiler/ets_frontend/merge_abc/BUILD.gn:148:5: which caused the file to be included.
    "$ark_third_party_root/protobuf:protobuf_lite_static",
    ^----------------------------------------------------
```

就会产生报错，通过查看错误日志后发现，这里是有一个依赖不能够被`external_deps_handler.py`处理，该依赖是`[hilog:libhilog]`。

通过日志发现，最先出现的调用栈为：`arkcompiler/ets_frontend/merge_abc/BUILD.gn:148:5`，因此可以查看：

``` gn
# Cause Proto -> hilog:libhilog
deps = [
    ":arkcompiler_generate_proto",
    "$ark_third_party_root/protobuf:protobuf_lite_static",
    "$ark_third_party_root/protobuf:protobuf_static",
]
```

可以发现是`protobuf_lite_static`依赖出现问题，因此进入`arkcompiler/toolchain/build/third_party_gn/protobuf/BUILD.gn:85:1`中进行查看：

``` gn
ohos_static_library("protobuf_lite_static") {
    ...
    if (!is_mingw) {
        if (current_toolchain != host_toolchain) {
            # target build, not host build
            defines = [ "HAVE_HILOG" ]
            external_deps = [ "hilog:libhilog" ]
        }
    } else {
        defines = [ "_FILE_OFFSET_BITS_SET_LSEEK" ]
    }
}
```

可以发现，在`ohos_static_library("protobuf_lite_static")`逻辑中，因为这里只是简单的判断`current_toolchain != host_toolchain`然后就添加了`external_deps = [ "hilog:libhilog" ]`从而导致无法处理`[ hilog:libhilog ]`。

因此，我们做出以下修改：

``` gn
# To Append the `enable_hilog` identifier
import("//arkcompiler/runtime_core/ark_config.gni")

ohos_static_library("protobuf_lite_static") {
    ...
    if (!is_mingw) {
        if (enable_hilog && current_toolchain != host_toolchain) {
            # target build, not host build
            defines = [ "HAVE_HILOG" ]
            external_deps = [ "hilog:libhilog" ]
        }
    } else {
        defines = [ "_FILE_OFFSET_BITS_SET_LSEEK" ]
    }
}
```

现在再次运行`riscv64`的构建脚本：

``` bash
python3 ./arkcompiler/toolchain/build/compile_script/ark.py riscv64.release --verbose

...

Done. Made 3926 targets from 543 files in 661ms

=== gn gen success! ===
```

#### runtime_core && toolchain

对于这两个结构而言，没有太多需要注意的地方，只有`runtime_core`构建出的两个可执行文件在后续可能会用上`ark_asm`和`ark_disasm`。

``` gn
group("runtime_core") {
  deps = [
    "$ark_root/assembler:ark_asm",
    "$ark_root/disassembler:ark_disasm",
  ]
}

group("toolchain") {
  if (target_cpu != "mipsel") {
    deps = [
      "$toolchain_root/inspector:ark_debugger",
      "$toolchain_root/inspector:connectserver_debugger",
      "$toolchain_root/tooling:libark_ecma_debugger",
    ]
  }
}
```

## Compile Show

![ArkTS result](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407011726816.png)