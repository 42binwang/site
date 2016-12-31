require('./global_env.js')
var util = require('util');
const fs = require('fs.extra');
var jr = require('./jaderender')
var colors = require('colors')

var print = console.log
var range = (n)=>{var a =[];for(var i=0;i<n;i++){a.push(i)}return a}
var pr = __projectroot

function jade(data){
  var html = jr(templdir,data)
  return html
}

var contentdir = pr + './content/'
var destdir = pr + './generated/'
destdir = process.argv[2]||destdir

var templdir = pr + './templates/site.jade'

function readfile(fpath){
  f = fs.readFileSync(fpath,'utf8')
  return f
}
function savefile(fpath,string){
  fs.writeFileSync(fpath,string)
}

function listdir(path){
  return fs.readdirSync(path)
}

function build_tree_from(pathpad,depth){
  depth = depth||0
  var tree = {
    path:pathpad,
    nodes:[],
  }
  pathpad+='/'
  var workingdir = contentdir +'/'+ pathpad
  var cf = listdir(workingdir)

  for(var i=0;i<cf.length;i++){
    var fname = cf[i]
    if(fs.lstatSync(workingdir+fname).isDirectory()){
      var subtree = build_tree_from(pathpad+fname,depth+1)
      tree.nodes.push(subtree)
    }else{
      var ext = fname.split('.')
      var fname_without_ext = ext[0]
      ext = ext.length==1?'':ext.pop()

      var leaf = {}
      leaf.workingdir = workingdir
      leaf.pathpad = pathpad
      leaf.depth = depth
      leaf.fname = fname
      leaf.fname_without_ext = fname_without_ext
      leaf.ext = ext
      tree.nodes.push(leaf);
    }
  }
  return tree
}

var treewalker = (tree,filter)=>{
  var newtree = {
    path:tree.path,
    nodes:[]
  }
  newtree.nodes = tree.nodes.map(node=>{
    if(node.ext){
      //file node object
      return filter(node)
    }else{
      // got subtree as node
      return treewalker(node,filter)
    }
  })
  .filter(n=>n!==null&&n!==undefined)
  return newtree
}

var ui = o=>util.inspect(o,{ depth: null })

print('building tree...'.cyan)
var filetree = build_tree_from('')

print('filetree:'.red, ui(filetree))

var process_markdown =(leaf)=>{
  var content = readfile(leaf.workingdir+leaf.fname)
  var match = content.match(/!(.*)/)
  if(match){
    content = content.slice(match[0].length)
  }

  var title = match?match[1]:'no title'
  print(`title is:`,title.red)

  var extract_plot = function(content){
    var plot = require('./plot.js')

    var plotcounter = 0
    // extract plot commands
    print('extracting plots...')

    content = content.replace(/<plot([\s\S]*?)\/>/gi,function(matching,p1,offset){
      // for each replaced plot, generate one svg
      var suffix = (plotcounter++).toString()
      var destfilename = leaf.fname_without_ext+'_plot_'+suffix+'.svg'
      print('generating',destfilename.cyan)
      var command = p1
      plot.intosvg(command, destdir+leaf.pathpad+destfilename)

      var tag = 'plot '+suffix
      return `<img class="plot" src="${destfilename}" title="${tag}" />`
    })

    return content
  }

  fs.mkdirpSync(destdir+leaf.pathpad)

  content = extract_plot(content)

  leaf.content = content
  leaf.title = title
  leaf.relative_rendered_path = leaf.pathpad+leaf.fname_without_ext+'.html'
  leaf.relative_root = '../'.repeat(leaf.depth)

  print('generating HTML...')
  var html = jade(leaf)
  print('generated. length:',html.length)

  leaf.output_fname = leaf.fname_without_ext+'.html'

  print(`writing file ${leaf.pathpad}${leaf.output_fname}...`)
  fs.writeFileSync(destdir+leaf.pathpad+leaf.output_fname,html)
  print('file written.')

  return leaf
}

var mdtree = treewalker(filetree,leaf=>leaf.ext=='md'?process_markdown(leaf):null)

var copytree = treewalker(filetree,leaf=>{
  if('py.html.htm.js.css.png.jpg.gif'.split('.').indexOf(leaf.ext)>=0){
    print('justCopy:'.green,leaf.fname.red)
    var fr = contentdir+leaf.pathpad+leaf.fname
    var to = destdir+leaf.pathpad+leaf.fname
    fs.copy(fr,to,{
      replace: true
    }, err=>err?console.error(err):null)

    return leaf
  }
})

print('copytree:'.red, ui(copytree))

print('done'.cyan)
