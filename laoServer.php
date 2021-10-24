<?php
class LAOServer
{
    protected $queryParam;
    protected $cnn;
    protected $pref;
    protected $User;

    function __construct()
    {
        set_error_handler(array(
            $this,
            'except'
        ));

        require 'setup.php';
        $this->pref = $setup['sql_pref'];
        try {
            $this->cnn = new \mysqli(
                $setup["sql_server"],
                $setup["sql_user"],
                $setup["sql_pass"],
                $setup["sql_DBname"]
            );
            $this->cnn->set_charset("utf8");
        } catch (\Exception $e) {
            $this->cnn = new \mysqli(
                $setup["sql_server"],
                $setup["sql_user"],
                $setup["sql_pass"]
            );
            $this->cnn->set_charset("utf8");
            $this->createBase($setup["sql_DBname"]);
        }

        $this->queryParam = file_get_contents('php://input');
    }

    public function doCommand()
    {
        if ($this->queryParam) {
            if (isset($_SERVER['PHP_AUTH_USER'])) {
                $this->login();
            } elseif (
                isset($_SERVER['HTTP_AUTHORIZATION']) and
                $this->authenticate($_SERVER['HTTP_AUTHORIZATION'])
            ) {
                $inParam = json_decode($this->queryParam, true);
                if ($inParam['cmd'] == 'getUserList')
                    $this->exit($this->getUserList());
            } else {
                $this->exit("authentication failure", true);
            }
        }
    }

    protected function authenticate($auth)
    {
        $token = [];
        if (!preg_match('/Bearer (\w+)/', $auth, $token) or !$token[1])
            return false;
        $token = $token[1];

        $User = $this->query(
            "SELECT * FROM {$this->pref}user AS T
            WHERE T.Hash = {$this->SQLValue($token)}"
        )->fetch_all(MYSQLI_ASSOC);

        if (count($User) == 1) {
            $this->User = $User[0];
            return true;
        }

        return false;
    }

    protected function login()
    {
        $usr = $this->query(
            "SELECT * FROM {$this->pref}user AS T 
            WHERE T.Login = {$this->SQLValue($_SERVER['PHP_AUTH_USER'])}"
        )->fetch_all(MYSQLI_ASSOC);

        if (count($usr) == 1 and $usr[0]['PWD'] == md5($_SERVER['PHP_AUTH_PW'] . $usr[0]['Salt'])) {
            $usr = $usr[0];
            $usr['Hash'] = md5($this->createGUID());
            $usr['LData'] = time();
            $this->setRow($usr, 'user');

            $this->exit(LAOServer::arrCopy($usr, 'Ref, Role, Hash, Name'));
        } else $this->exit('не верный логин или пароль', true);
    }

    protected function createBase($DBname)
    {
        if ($this->query("SHOW DATABASES LIKE '$DBname'")->num_rows == 0) {

            $this->cnn->multi_query(
                "CREATE DATABASE {$DBname} CHARACTER SET utf8; " .
                    "USE {$DBname}; " .
                    "CREATE TABLE {$this->pref}config (" .
                    " Ver INT" .
                    "); " .
                    "CREATE TABLE {$this->pref}user ( " .
                    " Ref CHAR(36) NOT NULL PRIMARY KEY, " .
                    " Role TINYINT, " .
                    " Login VARCHAR(50), " .
                    " PWD VARCHAR(32), " .
                    " Hash VARCHAR(32), " .
                    " Salt VARCHAR(3), " .
                    " Name VARCHAR(255), " .
                    " LData INT UNSIGNED " .
                    ");  " .
                    "INSERT INTO {$this->pref}config SET " .
                    " ver = 1; "
            );
            while ($this->cnn->more_results()) {
                $this->cnn->next_result();
                if ($this->cnn->errno) {
                    $msg = $this->cnn->error;
                    $this->query("DROP DATABASE IF EXISTS $DBname");
                    throw new \Exception("$msg");
                }
            }
            $this->addUser('admin', 'admin');
        }
    }

    protected function addUser($Login, $PWD, $Role = null, $Name = null)
    {
        $salt = (string) rand(100, 999);
        $this->setRow([
            'Ref' => $this->createGUID(),
            'Role' => $Role ?? 1,
            'Login' => $Login,
            'PWD' => md5($PWD . $salt),
            'Salt' => $salt,
            'Name' => $Name ?? $Login
        ], 'user');
    }

    protected function getUserList()
    {
        return $this->query(
            "SELECT Name, Role, Ref, LData  FROM {$this->pref}user"
        )->fetch_all(MYSQLI_ASSOC);
    }

    protected function getRow($Ref, $Table)
    {
        return $this->query("SELECT * FROM {$this->pref}{$this->escape($Table)} WHERE Ref = {$this->SQLValue($Ref)}")
            ->fetch_all(MYSQLI_ASSOC);
    }

    protected function setRow($Row, $Table)
    {
        $text = '';
        foreach ($Row as $Key => $Value) {
            $text .= $text == '' ? '' : ', ';
            $text .= "{$this->escape($Key)} = {$this->SQLValue($Value)}";
        }

        if (count($this->getRow($Row['Ref'], $Table)) == 0) {
            $text = "INSERT INTO {$this->pref}{$this->escape($Table)} SET " . $text;
        } else {
            $text = "UPDATE {$this->pref}{$this->escape($Table)} 
                SET {$text} WHERE Ref = {$this->SQLValue($Row['Ref'])}";
        }

        $this->query($text);
    }

    protected function query($Text)
    {
        try {
            $rezult = $this->cnn->query($Text);
        } catch (\Exception $e) {
            $this->exit("{$e->getMessage()}; $Text", true);
        }
        if (!$rezult)
            $this->exit("{$this->cnn->error}; $Text", true);
        return $rezult;
    }

    protected function SQLValue($Value)
    {
        if (is_string($Value)) {
            return "'{$this->escape($Value)}'";
        } elseif (is_int($Value)) {
            return "{$Value}";
        } elseif (is_float($Value)) {
            return sprintf('%0.2F', $Value);
        } elseif (is_bool($Value)) {
            if ($Value) {
                return 'TRUE';
            } else {
                return 'FALSE';
            }
        } elseif (is_null($Value)) {
            return 'NULL';
        } else {
            $this->exit('Не верный тип', true);
        }
    }

    protected function escape(string $Text)
    {
        $Rezult = trim($Text);
        if (strlen($Rezult) > 1 and $Rezult[0] == '"' and $Rezult[strlen($Rezult) - 1] == '"') {
            $Rezult = substr($Rezult, 1, strlen($Rezult) - 2);
        }
        return $this->cnn->real_escape_string($Rezult);
    }

    protected static function createGUID()
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }

    protected static function arrCopy($arr, $field)
    {
        $result = [];
        foreach (explode(',', $field) as $value) {
            $value = trim($value);
            $result[$value] = $arr[$value];
        };
        return $result;
    }

    public static function exit($result, $onErr = false)
    {
        print_r(json_encode([
            "S_Ok" => !$onErr,
            "result" => $result
        ]));
        exit();
    }

    public static function except($errno, $errstr, $errfile = null, $errline = null)
    {
        throw new \Exception($errstr, $errno);
    }
}
