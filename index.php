<?php
spl_autoload_register(function ($class_name) {
    include $class_name . '.php';
});

try {
    $Base = new LAOServer();
    $Base->doCommand();
} catch (\Exception $e) {
    LAOServer::exit($e->getMessage(), true);
}

require 'MainForm.html';
