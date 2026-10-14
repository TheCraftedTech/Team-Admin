import greenfoot.*;  // (World, Actor, GreenfootImage, Greenfoot and MouseInfo)

/**
 * Write a description of class MyWorld here.
 * 
 * @author (your name) 
 * @version (a version number or a date)
 */
public class MyWorld extends World
{

    /**
     * Constructor for objects of class MyWorld.
     * 
     */
    public MyWorld()
    {    
        // Create a new world with 600x400 cells with a cell size of 1x1 pixels.
        super(780, 360, 1,false); 
        addObject(new background(),0,0);
        
        for(int i = 0; i < 30; i++)
        {
            addObject(new star(),0,i);
            
        }
        for(int i = 0; i < 30; i++)
        {
            addObject(new star2(),0,i);
            
        }
        for(int i = 0; i < 30; i++)
        {
            addObject(new star3(),0,i);
            
        }
    }
}
