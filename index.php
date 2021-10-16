<?php
spl_autoload_register(function ($class_name) {
    include $class_name . '.php';
});

try {
    $Base = new LAOServer();
    $Base->doCommand();
} catch (\Exception $e) {
    echo $e->getMessage();
    die;
}

require 'MainForm.html';
