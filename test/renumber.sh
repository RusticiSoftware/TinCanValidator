#!/bin/bash

# requires bash v2 or higher
bash_maj_version=$( 
    bash --version | 
    grep -o '[Vv]\(ersion \?\)\?[0-9]\.[0-9]\+\(\.[0-9]\+\)\?' | 
    cut -d' ' -f2 | 
    cut -d. -f1 
)
(( $bash_maj_version < 2 )) && 
    echo "This script requires bash version 2 or greater" &&
    exit 1


function abspath() {
    pushd "$1" >/dev/null
    echo "$PWD"
    popd >/dev/null
}

thisdir="$(dirname "$0")"
thisdir="$(abspath "$thisdir")"

dryrun=y
undo=

function main() {
    case "$1" in
        -[hH]*)
            showOptions
            exit 1
            ;;
        -x)
            dryrun=
            echo "# Renumbering files..." 
            ;;
        '')
            echo "# Doing a dry run; nothing is actually being changed"
            ;;
        *)
            echo 'bad option: ' $1
            showOptions
            exit 1
            ;;
    esac
    
    renumber "$thisdir"/data
    echo "# Done"
    if [[ "$undo" == "" ]]; then
        echo "# No files needed renumbering"
        return
    fi
    
    if [[ "$dryrun" == "" ]]; then
        echo
        echo "# To undo the above:"
        echo "$undo"
    fi
    
}

function showOptions() {
    echo "OPTIONS:"
    echo "  -h  Show this help"
    echo "  -x  Renumber for real. Use with caution!"
    echo
    echo "By default, this program runs in a safe, dry-run mode."
    echo "If after reviewing the changes you are satisfied, you"
    echo "may re-run this program with the -x option."
    echo
    exit 1
}

function renumber() {
    for subdir in "$1"/*; do
        [[ -d "$subdir" ]] && renumberFiles "$subdir"
    done
}

function renumberFiles() {
    # Counters for different series of tests
    local t0=000
    local t1=100
    local t2=200
    local t3=300
    
    local tnum          # test number in current test's category
    local thisNum       # old test number of current test
    local restName      # filename of current test, excluding test number
    local tclass        # one of t0, t1, t2, t3
    local mvCommand     # the command to rename the current test
    local undoCommand   # the inverse of mvCommand
    local file          # current test file
    local tmpdir
    local base          # `basename $file`
    local newName       # new name of current test
    
    pushd "$1" >/dev/null
    
    # Order good files before bad ones
    for file in *-good*.json *-bad*.json; do
        [[ -f "$file" ]] || continue
        thisNum="$(echo "$file" | cut -d- -f1)"
        restName="$(echo "${file#$thisNum}")"
        case $thisNum in
            0*) tclass=t0;;
            1*) tclass=t1;;
            2*) tclass=t2;;
            3*) tclass=t3;;
            *) echo "could not determine test class of '$file'"; exit 1;;
        esac
        tnum=${!tclass}
        
        base="`basename "$file"`"
        file="$PWD/$base"
        newName="$PWD/$tnum$restName"
        
        if [[ "$file" != "$newName" ]]; then
            if [[ -e "$newName" ]]; then
                echo "Name collision at \"$file\" and \"$newName\"; aborting"
                return
            else
                mvCommand=mv\ \"$PWD/\"{$base,$tnum$restName}
                undoCommand=mv\ \"$PWD/\"{$tnum$restName,$base}
            fi
            
            undo="$( echo "$undoCommand"; echo "$undo" )"
            
            if [[ "$dryrun" ]]; then
                echo $mvCommand
            else
                echo "#>" $mvCommand
                eval $mvCommand
            fi
        fi
        
        # Increment the test number
        eval $tclass=$(nextNum $tnum)
    done   
    
    popd >/dev/null
}

function nextNum() {
    local nextInt
    nextInt=$( echo $1 | grep -o '[1-9][0-9]*$' || echo 0 )
    nextInt="$(($nextInt + 1))"
    printf '%03d' $nextInt
}

main $@

