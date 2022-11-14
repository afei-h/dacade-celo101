// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;


interface IERC20Token {
  function transfer(address, uint256) external returns (bool);
  function approve(address, uint256) external returns (bool);
  function transferFrom(address, address, uint256) external returns (bool);
  function totalSupply() external view returns (uint256);
  function balanceOf(address) external view returns (uint256);
  function allowance(address, address) external view returns (uint256);

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title Anypixels
 * @notice a contract anyone can creat and trade his own pixel art on it
 */
contract Anypixels {
    // @notice a data structure to store a 8x8 pixel image
    // @dev store pixels in bytes32 is cheaper than number array
    // @param owner of the image
    // @param pixels store every pixel's color value, 6 rows correspond to R G B R G B;
    // @param artist who drawn this image
    struct Canvas {
        string name;
        address owner;
        bytes32[6] pixels;
        address artist;
        string description;
        uint256 price;
    }

    //owner of the address 
    address public owner;

    //royalty a portion(royalty%) of the price will be transfered to artist of the canvas
    uint256 public royalty;

    //store all the pixel arts
    Canvas[] internal canvases;

    address internal cUsdTokenAddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;

    // @notice set the owner of the address and the inital royalty
    constructor(uint256 _royalty) reasonableRoyalty(_royalty) {
        royalty = _royalty;
        owner = msg.sender;
    }

    // @notice restrict the royalty in reasonable range 
    modifier reasonableRoyalty(uint256 _royalty) {
        require (_royalty <= 20, "royalty too high!");
        _;
    }

    // @notice create a new canvas
    // @param _name name of the new canvas
    // @param _pixels an array of every pixel color value
    // @param _description a short description about the art
    // @param _price price of the new canvas
    function createCanvas(string memory _name, bytes32[6] memory _pixels, string memory _description ,uint256 _price) public {
        canvases.push(Canvas(_name, msg.sender, _pixels, msg.sender, _description, _price));
    }

    // @notice set a new price
    function setPrice(uint256 _index, uint256 _price) public {
        require (msg.sender == canvases[_index].owner, "Only holder can change price!");
        canvases[_index].price = _price;
    }

    // @notice return the canvas correspond to index
    function readCanvas(uint256 _index) public view returns (
        string memory,
        address, 
        bytes32[6] memory, 
        address, 
        string memory,
        uint256
    ){
        return (
            canvases[_index].name, 
            canvases[_index].owner, 
            canvases[_index].pixels, 
            canvases[_index].artist, 
            canvases[_index].description,
            canvases[_index].price
        );
    }

    //@ notice returns the amount of meals in the contract
    function getCanvasLength() public view returns(uint256) {
        return canvases.length;
    }

    // @notice buy a canvas correspond to index
    // @dev a portion of the price is transfered to artist, remain to owner.
    function buyCanvas(uint256 _index) public {
        uint256 royaltyFee = canvases[_index].price * royalty / 100;
        require(
            IERC20Token(cUsdTokenAddress).transferFrom(
                msg.sender,
                canvases[_index].artist,
                royaltyFee
            )&&
            IERC20Token(cUsdTokenAddress).transferFrom(
                msg.sender,
                canvases[_index].owner,
                canvases[_index].price - royaltyFee
            ),
          "Transfer failed."
        );
        canvases[_index].owner = msg.sender;
    }

    // @notice set a new royalty, only owner
    function setRoyalty(uint256 _royalty) public reasonableRoyalty(_royalty) {
        require(msg.sender == owner, "Only contract owner can modify royalty");
        royalty = _royalty;
    }
}

