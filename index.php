<?php
spl_autoload_register(function ($class_name) {
    include $class_name . '.php';
});

try {
    $Base = new laoServer();
} catch (\Exception $e) {
    echo $e->getMessage();
    die;
}

require 'MainForm.html';
